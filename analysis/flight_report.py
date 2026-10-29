#!/usr/bin/env python3
"""Offline XPlane Motion Controller debrief report.

Usage: python analysis/flight_report.py record.json --output report.pdf
Requires matplotlib. Input is a user-exported xmc.flight-record.v1 archive.
No network access or simulator interaction occurs.
"""
from __future__ import annotations
import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

FIELDS = ('ias','alt','vs','bank','pitch','n1l','n1r','egtl','egtr','throttle','flap','risk','gear','ap')

def load_record(path:Path)->dict:
    if path.stat().st_size>16_000_000:raise ValueError('record is too large')
    data=json.loads(path.read_text(encoding='utf-8'))
    if data.get('schema')!='xmc.flight-record.v1':raise ValueError('unsupported archive format')
    samples=data.get('samples')
    if not isinstance(samples,list) or len(samples)>150000:raise ValueError('invalid sample count')
    last=-1
    for p in samples:
        if not isinstance(p,dict) or type(p.get('at')) is not int or p['at']<last:raise ValueError('nonmonotonic timestamp')
        last=p['at']
        for field in FIELDS:
            v=p.get(field)
            if v is not None and (type(v) not in (int,float) or not math.isfinite(v)):
                raise ValueError(f'invalid field {field}')
    return data

def get(data,key):return [p.get(key) for p in data['samples']]
def maximum_abs(items):
    values=[abs(x) for x in items if isinstance(x,(int,float))]
    return max(values) if values else None

def summary(data):
    samples=data['samples'];stats={"samples":len(samples),"duration_s":(samples[-1]['at']-samples[0]['at'])/1000 if len(samples)>1 else 0}
    for key in ('ias','alt','vs','bank','pitch','risk'):
        v=[x for x in get(data,key) if isinstance(x,(int,float))]
        stats['max_'+key]=max(v) if v else None
        stats['max_abs_'+key]=maximum_abs(v)
    pairs=[abs(p['n1l']-p['n1r']) for p in samples if isinstance(p.get('n1l'),(int,float)) and isinstance(p.get('n1r'),(int,float))]
    stats['mean_engine_n1_asymmetry_pct']=sum(pairs)/len(pairs) if pairs else None
    stats['events']=len(data.get('events',[]))
    return stats

def report(data,output:Path):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from matplotlib.backends.backend_pdf import PdfPages
    samples=data['samples'];stats=summary(data)
    if not samples:raise ValueError('recording contains no samples')
    x=[(p['at']-samples[0]['at'])/1000 for p in samples]
    def cleaned(key):return [float(p[key]) if isinstance(p.get(key),(int,float)) else math.nan for p in samples]
    with PdfPages(output) as pdf:
        fig=plt.figure(figsize=(12,8));ax=fig.add_axes([.08,.12,.84,.72]);ax.axis('off');ax.text(0,.95,'XPLANE FLIGHT DEBRIEF',fontsize=24,weight='bold',transform=ax.transAxes)
        ax.text(0,.88,f"Aircraft: {data.get('aircraftIcao') or 'UNKNOWN'}    Source: {data.get('source','UNKNOWN').upper()}    {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",fontsize=11,transform=ax.transAxes)
        cells=list(stats.items())
        columns=2
        row_count=math.ceil(len(cells)/columns)
        for i,(k,v) in enumerate(cells):
            column=i//row_count
            row=i%row_count
            ax.text(.02+column*.51,.78-row*.075,
                    f'{k.replace("_"," ").upper()[:27]:27s} {"N/A" if v is None else round(v,2)}',
                    fontsize=9.3,transform=ax.transAxes,fontfamily='monospace')
        ax.text(0,.04,'SIMULATOR ADVISORY ANALYTICS ONLY / NOT A CERTIFIED FLIGHT DATA RECORDER',fontsize=9,transform=ax.transAxes);pdf.savefig(fig);plt.close(fig)
        for keys,title,unit in [(['ias'],'Indicated airspeed','kt'),(['alt','vs'],'Altitude / vertical speed (independent scales)','raw units'),(['bank','pitch'],'Aircraft attitude','degrees'),(['n1l','n1r'],'Engine spool symmetry','%'),(['egtl','egtr'],'Exhaust gas temperature','deg C'),(['risk'],'Risk history','advisory index')]:
            fig,ax=plt.subplots(figsize=(12,5));
            for k in keys:ax.plot(x,cleaned(k),label=k,linewidth=1.4)
            for e in data.get('events',[]):
                if type(e.get('at')) is int:ax.axvline((e['at']-samples[0]['at'])/1000,alpha=.25,linewidth=.8)
            ax.set_title(title);ax.set_xlabel('Elapsed seconds');ax.set_ylabel(unit);ax.legend(loc='best');ax.grid(alpha=.2);fig.tight_layout();pdf.savefig(fig);plt.close(fig)
        fig,ax=plt.subplots(figsize=(7,7));ax.scatter(cleaned('n1l'),cleaned('n1r'),s=6,alpha=.5);ax.plot([0,100],[0,100],linestyle='--',linewidth=1);ax.set(xlabel='Engine 1 N1 (%)',ylabel='Engine 2 N1 (%)',title='Engine spool symmetry',xlim=(0,110),ylim=(0,110));ax.grid(alpha=.2);fig.tight_layout();pdf.savefig(fig);plt.close(fig)
    return stats

def main():
    parser=argparse.ArgumentParser(description='Generate a detailed simulator flight debrief PDF')
    parser.add_argument('record',type=Path);parser.add_argument('--output',type=Path,default=Path('flight-report.pdf'))
    parser.add_argument('--html',type=Path,help='Optional self-contained HTML report')
    args=parser.parse_args();data=load_record(args.record);stats=report(data,args.output)
    if args.html:
        import html
        import base64
        from io import BytesIO
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        x=[(p['at']-data['samples'][0]['at'])/1000 for p in data['samples']]
        figures=[]
        for fields,title in [(['ias'],'Airspeed'),(['alt'],'Altitude'),(['n1l','n1r'],'Engine N1'),(['risk'],'Advisory risk')]:
            fig,ax=plt.subplots(figsize=(11,3.4))
            for f in fields: ax.plot(x,[p.get(f) if p.get(f) is not None else math.nan for p in data['samples']],label=f,linewidth=1.5)
            ax.legend(loc='best');ax.grid(alpha=.2);ax.set(xlabel='Elapsed seconds',title=title);fig.tight_layout()
            io=BytesIO();fig.savefig(io,format='png',dpi=135);plt.close(fig)
            figures.append('<h2>'+html.escape(title)+'</h2><img alt="'+html.escape(title)+'" src="data:image/png;base64,'+base64.b64encode(io.getvalue()).decode('ascii')+'">')
        rows=''.join(f'<tr><th>{html.escape(k)}</th><td>{"Unavailable" if v is None else html.escape(str(round(v,2)))}</td></tr>' for k,v in stats.items())
        page='<!doctype html><html lang="en"><meta charset="utf-8"><title>Flight debrief</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;background:#0f2233;color:#e5f2f8}h1{letter-spacing:.05em}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #345267;padding:9px}img{max-width:100%}small{color:#a1bbcb}</style><h1>Flight debrief</h1><small>Simulator advisory analytics only - not a certified flight data recorder</small><table>'+rows+'</table>'+''.join(figures)+'</html>'
        args.html.write_text(page,encoding='utf-8')
    print(json.dumps({'output':str(args.output),'html':str(args.html) if args.html else None,'summary':stats},indent=2))
if __name__=='__main__':main()
