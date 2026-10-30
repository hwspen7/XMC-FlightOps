      {/* XMC top heading band v4: compass and digital heading in the upper instrument strip. */}
      <rect x="0" y="320" width="640" height="45" fill="#071723"/>
      <rect x="0" y="320" width="99" height="45" fill="#092032"/>
      <text x="9" y="334" fill="#70cef7" fontSize="10">GS / KT</text>
      <text x="10" y="357" fill="#e6faff" fontSize="17" fontWeight="750">{fmt(telemetry.groundSpeedKnots,live)}</text>
      <rect x="99" y="320" width="86" height="45" fill="#0c2739"/>
      <path d="M99 321V364M185 321V364" stroke="#385c74"/>
      <text x="109" y="334" fill="#70cef7" fontSize="10">AGL / FT</text>
      <text x="110" y="357" fill="#f4efd0" fontSize="17" fontWeight="750">
        {radioAltitudeFeet(telemetry.aglFeet,live) === null ? '---' : radioAltitudeFeet(telemetry.aglFeet,live)}
      </text>
      <rect x="185" y="320" width="455" height="45" fill="#092032"/>
      <path d="M310 321V364M449 321V364" stroke="#294b62"/>
      <text x="204" y="334" fill="#70cef7" fontSize="10">BANK / DEG</text>
      <text x="205" y="356" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(attitude?.roll ?? null,Boolean(attitude),1)}°</text>
      <text x="327" y="334" fill="#70cef7" fontSize="10">PITCH / DEG</text>
      <text x="328" y="356" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(attitude?.pitch ?? null,Boolean(attitude),1)}°</text>
      <text x="471" y="334" fill="#70cef7" fontSize="10">MACH</text>
      <text x="472" y="356" fill="#e6faff" fontSize="16" fontWeight="750">{fmt(telemetry.machNumber,live,2)}</text>
      {/* Heading tape drawn last so the pitch horizon cannot overlay its top-row labels. */}
      <g aria-label="Magnetic heading scale above the attitude display">
        <rect x="101" y="0" width="344" height="52" fill="#081b2c" stroke="#355772" strokeWidth="1"/>
        <line x1="105" y1="33" x2="441" y2="33" stroke="#345972" strokeWidth="1"/>
        {compassTicks.map(({angle,x,major}) => x > 109 && x < 438 && <g key={angle}>
          <path d={`M${x} 5v${major ? 12 : 6}`} stroke="#97d6f2" strokeWidth={major ? 1.5 : 1}/>
          {major && <text x={x} y="29" textAnchor="middle" fill="#c6e9fa" fontSize="11" fontWeight="700">
            {angle === 0 ? 'N' : angle === 90 ? 'E' : angle === 180 ? 'S' : angle === 270 ? 'W' : String(angle/10).padStart(2,'0')}
          </text>}
        </g>)}
        <path d="M272 30v5" stroke="#f4dc76" strokeWidth="2"/>
        <rect x="231" y="35" rx="3" width="82" height="16" fill="#041220" stroke="#6b93ab"/>
        <text x="272" y="48" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="800">
          {headingNormalized === null ? '---' : Math.round(headingNormalized).toString().padStart(3,'0')}°
        </text>
      </g>
