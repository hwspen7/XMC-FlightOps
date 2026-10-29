import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from flight_report import load_record, summary

class FlightReportTest(unittest.TestCase):
 def test_measurements(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp)/'a.json';p.write_text(json.dumps({'schema':'xmc.flight-record.v1','source':'live','samples':[{'at':1000,'ias':110,'bank':-22,'n1l':80,'n1r':78},{'at':2000,'ias':130,'bank':15,'n1l':72,'n1r':76}]}))
   data=load_record(p);self.assertEqual(summary(data)['max_ias'],130);self.assertEqual(summary(data)['max_abs_bank'],22)
 def test_rejects_unsorted_times(self):
  with TemporaryDirectory() as tmp:
   p=Path(tmp)/'a.json';p.write_text(json.dumps({'schema':'xmc.flight-record.v1','samples':[{'at':200},{'at':100}]}))
   with self.assertRaises(ValueError):load_record(p)
if __name__=='__main__':unittest.main()
