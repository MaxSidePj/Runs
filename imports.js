import {validRun,isoDate} from './core.js';
const convert=(value,unit)=>{const n=Number(value);if(!Number.isFinite(n))return NaN;return ['km','kilometer','kilometre'].includes(unit)?n:['mi','mile'].includes(unit)?n*1.609344:['m','meter','metre'].includes(unit)?n/1000:NaN;};
const unescape=s=>s.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:]+)\s*=\s*"([^"]*)"/g)].map(m=>[m[1],unescape(m[2])]));
export function appleWorkout(block,today=isoDate()) {
  const a=attrs(block.slice(0,block.indexOf('>')+1)),sport=a.workoutActivityType==='HKWorkoutActivityTypeRunning'?'run':a.workoutActivityType==='HKWorkoutActivityTypeWalking'?'walk':null;
  if(!sport)return null;
  let km=convert(a.totalDistance,a.totalDistanceUnit);
  if(!Number.isFinite(km))for(const match of block.matchAll(/<WorkoutStatistics\b[^>]*\/?\s*>/g)){
    const s=attrs(match[0]);if(s.type==='HKQuantityTypeIdentifierDistanceWalkingRunning'){km=convert(s.sum,s.unit);break;}}
  const duration=Number(a.duration)*(a.durationUnit==='min'?60:['s','sec'].includes(a.durationUnit)?1:NaN);
  if(!Number.isFinite(km)||km<=0||!Number.isFinite(duration)||duration<=0)return null;
  const key=`apple:${a.startDate}:${sport}:${km.toFixed(3)}`;
  return validRun({id:key,importKey:key,date:a.startDate?.slice(0,10),distanceKm:km,seconds:duration,sport,
    title:sport==='walk'?'Apple Watch walk':'Apple Watch run',source:'apple-health',timing:'workout'},today);
}
export class AppleWorkoutReader {
  constructor(today=isoDate()){this.buffer='';this.runs=[];this.today=today;this.skipped=0;}
  push(text){this.buffer+=text;while(true){const start=this.buffer.search(/<Workout[\s>]/);if(start<0){this.buffer=this.buffer.slice(-32);return;}this.buffer=this.buffer.slice(start);
      const open=this.buffer.indexOf('>');if(open<0)return;const selfClosing=this.buffer.slice(0,open).trimEnd().endsWith('/');
      const close=selfClosing?open:this.buffer.indexOf('</Workout>');if(close<0){if(this.buffer.length>2e6)throw new Error('A workout record is unusually large. Try importing an individual GPX or TCX file.');return;}
      const end=selfClosing?close+1:close+10,block=this.buffer.slice(0,end);this.buffer=this.buffer.slice(end);
      const r=appleWorkout(block,this.today);if(r)this.runs.push(r);else this.skipped++;}}
  finish(){if(/<Workout[\s>]/.test(this.buffer))throw new Error('The Health export ends inside a workout. Export it again.');return {runs:this.runs,skipped:this.skipped};}
}
export async function importAppleFile(file,progress=()=>{}) {
  const parser=new AppleWorkoutReader(),decoder=new TextDecoder();
  if(!file.stream){if(file.size>20e6)throw new Error('This browser cannot stream a large Health export. Update iOS or import smaller activity files.');parser.push(await file.text());return parser.finish();}
  const reader=file.stream().getReader();let bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;parser.push(decoder.decode(value,{stream:true}));progress(bytes/file.size);}
    parser.push(decoder.decode());return parser.finish();}finally{reader.releaseLock();}
}
export function importGPS(text,format='gpx',sport='run',today=isoDate()) {
  const xml=new DOMParser().parseFromString(text,'application/xml');if(xml.querySelector('parsererror'))throw new Error('This activity XML could not be read.');
  const nodes=name=>Array.from(xml.getElementsByTagNameNS('*',name));
  let km=0,secs=0,date,title;
  if(format==='tcx'){
    const laps=nodes('Lap');km=laps.reduce((s,l)=>s+Number(l.getElementsByTagNameNS('*','DistanceMeters')[0]?.textContent||0),0)/1000;
    secs=laps.reduce((s,l)=>s+Number(l.getElementsByTagNameNS('*','TotalTimeSeconds')[0]?.textContent||0),0);
    const stamp=nodes('Id')[0]?.textContent||laps[0]?.getAttribute('StartTime');date=stamp?isoDate(new Date(stamp)):null;title='Imported TCX';
  }else{
    let first=null,last=null;
    const rad=n=>n*Math.PI/180;
    for(const segment of nodes('trkseg')){let previous=null;
      for(const p of Array.from(segment.getElementsByTagNameNS('*','trkpt'))){const point=[Number(p.getAttribute('lat')),Number(p.getAttribute('lon'))];if(point.some(v=>!Number.isFinite(v)))continue;
        if(previous){const a=Math.sin(rad(point[0]-previous[0])/2)**2+Math.cos(rad(previous[0]))*Math.cos(rad(point[0]))*Math.sin(rad(point[1]-previous[1])/2)**2;km+=6371*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));}previous=point;
        const stamp=p.getElementsByTagNameNS('*','time')[0]?.textContent;if(stamp){if(!first)first=stamp;last=stamp;}}}
    secs=first&&last?(new Date(last)-new Date(first))/1000:NaN;date=first?isoDate(new Date(first)):null;title=nodes('name')[0]?.textContent||'Imported GPX';
  }
  const key=`gps:${date}:${sport}:${km.toFixed(3)}:${Math.round(secs)}`;
  return [validRun({id:key,importKey:key,date,distanceKm:km,seconds:secs,sport,title,source:'file',timing:format==='gpx'?'elapsed':'workout'},today)];
}
