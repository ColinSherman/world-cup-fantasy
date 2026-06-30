// ISO 3166-1 alpha-2 (with GB subdivisions) for the flag-icons CSS package.
export const CODE = {
  Argentina: 'ar', Netherlands: 'nl', Switzerland: 'ch', Norway: 'no', 'South Africa': 'za',
  Ghana: 'gh', Mexico: 'mx', Japan: 'jp', Canada: 'ca', 'New Zealand': 'nz',
  'United States': 'us', Algeria: 'dz', France: 'fr', Germany: 'de', Ecuador: 'ec',
  'Ivory Coast': 'ci', Scotland: 'gb-sct', 'Bosnia and Herzegovina': 'ba', Spain: 'es', Qatar: 'qa',
  Egypt: 'eg', Uzbekistan: 'uz', 'Saudi Arabia': 'sa', Paraguay: 'py', Sweden: 'se',
  Czechia: 'cz', 'South Korea': 'kr', 'DR Congo': 'cd', Haiti: 'ht', Austria: 'at',
  England: 'gb-eng', Brazil: 'br', Croatia: 'hr', Tunisia: 'tn', Portugal: 'pt',
  Colombia: 'co', Panama: 'pa', Jordan: 'jo', 'Curaçao': 'cw', Australia: 'au',
  Belgium: 'be', Morocco: 'ma', Senegal: 'sn', 'Cape Verde': 'cv',
};
export const flagClass = (t) => 'fi fi-' + (CODE[t] || 'un');
