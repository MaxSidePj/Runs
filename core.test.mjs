import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as core from './core.js';
import * as imports from './imports.js';
const today='2026-11-06';
const profile=overrides=>core.validProfile({weeklyKm:12,longestKm:5,currentDays:2,targetDays:3,days:[0,2,4],created:'2026-11-02',...overrides},today);
const run=(date,km=4,extra={})=>core.validRun({id:date+km,date,distanceKm:km,seconds:km*360,effort:4,...extra},today);

test('no personal training prescription before a baseline is supplied',()=>{
  assert.equal(core.suggest([],null,{},today).kind,'setup');
  assert.throws(()=>profile({longestKm:20}));
  assert.throws(()=>profile({targetDays:5,days:[0,2,4]}));
});
test('user chooses weekly frequency without automatically raising weekly kilometres',()=>{
  const result=core.suggest([],profile({targetDays:4,days:[1,2,4,6]}),{},today);
  assert.equal(result.frequency,4);
  assert.equal(result.targetKm,12);
  assert.ok(result.weeks[0].sessions.every(s=>s.km<=5.4));
  assert.ok(result.weeks[1].sessions.every(s=>s.km<=5+1.5));
});
test('an actual longer run updates the baseline and preserves recovery',()=>{
  const result=core.suggest([run(today,10)],profile(),{},today);
  assert.ok(result.next);
  assert.ok(result.weeks.slice(1).flatMap(w=>w.sessions).find(s=>s.long).km>=10);
  assert.ok(result.weeks[0].sessions.reduce((sum,s)=>sum+s.km,10)<=result.targetKm+.1);
  assert.ok(result.next.date>today);
});

test('a logged 4 km run replaces a stale 1 km long-run baseline',()=>{
  const p=profile({weeklyKm:3,longestKm:1,currentDays:3,days:[1,3,0]});
  const result=core.suggest([run('2026-11-02',4)],p,{},today);
  assert.equal(result.weeks[0].sessions.find(s=>s.long).km,4);
  assert.ok(result.weeks[1].sessions.find(s=>s.long).km>4);
  assert.equal(p.longestKm,1,'stored settings are not overwritten');
});

test('editing and deleting runs immediately changes the derived baseline',()=>{
  const p=profile({weeklyKm:3,longestKm:1,currentDays:3,days:[1,3,0]});
  const nextLong=runs=>core.suggest(runs,p,{},today).weeks[1].sessions.find(s=>s.long).km;
  assert.ok(nextLong([run('2026-11-02',6)])>nextLong([run('2026-11-02',4)]));
  assert.ok(nextLong([run('2026-11-02',4)])>nextLong([]));
});

test('walks, hard runs, painful runs and old runs do not raise the baseline',()=>{
  const p=profile({weeklyKm:3,longestKm:1,currentDays:3,days:[1,3,0]});
  const nextLong=runs=>core.suggest(runs,p,{},today).weeks[1].sessions.find(s=>s.long).km;
  for(const activity of [run('2026-11-02',4,{sport:'walk'}),run('2026-11-02',4,{effort:9}),run('2026-11-02',4,{pain:true}),run('2026-10-01',4)]) {
    assert.equal(nextLong([activity]),nextLong([]));
  }
  assert.ok(nextLong([run('2026-11-02',4,{effort:null})])>nextLong([]));
});

test('zero-baseline settings learn distance targets from a logged run',()=>{
  const p=profile({weeklyKm:0,longestKm:0,currentDays:0,days:[1,3,0]});
  assert.equal(core.suggest([run('2026-11-02',4)],p,{},today).kind,'train');
  assert.equal(core.suggest([run('2026-11-02',1)],p,{},today).kind,'beginner');
});

test('remaining mileage is never shown as a shrunken easy long run',()=>{
  const result=core.suggest([run(today,11)],profile(),{},today);
  assert.ok(result.weeks[0].sessions.every(s=>!s.long||s.km>=11));
});

test('fatigue and lighter weeks still reduce the learned long run',()=>{
  const p=profile({weeklyKm:3,longestKm:1,currentDays:3,days:[1,3,0]});
  const activities=[run('2026-11-02',4)];
  const tired=core.suggest(activities,p,{date:today,feeling:'tired'},today);
  assert.ok(tired.weeks[0].sessions.filter(s=>s.long).every(s=>s.km<4));
  const lighter=core.suggest(activities,{...p,created:'2026-10-12'},{},today);
  assert.equal(lighter.weeks[0].phase,'lighter');
  assert.ok(lighter.weeks[0].sessions.find(s=>s.long).km<4);
});
test('choosing fewer days does not compress mileage into oversized runs',()=>{
  const result=core.suggest([],profile({weeklyKm:40,longestKm:8,currentDays:5,targetDays:2,days:[2,6]}),{},today);
  assert.equal(result.targetKm,16);assert.ok(result.weeks[0].sessions.every(s=>s.km<=8));
  assert.ok(result.weeks[1].sessions.every(s=>s.km<=8+1.5));
});
test('pain pauses running, including pain recorded on a walk',()=>{
  assert.equal(core.suggest([],profile(),{date:today,feeling:'pain'},today).kind,'rest');
  assert.equal(core.suggest([run(today,3,{sport:'walk',pain:true})],profile(),{},today).kind,'rest');
});
test('walks remain stored but do not count as running mileage or frequency',()=>{
  const result=core.summary([run(today,5),run(today,9,{sport:'walk'})],today);
  assert.equal(result.weekKm,5);assert.equal(result.weekRuns,1);
});
test('progression requires two complete manageable weeks and known effort',()=>{
  const days=['2026-10-19','2026-10-21','2026-10-23','2026-10-26','2026-10-28','2026-10-30'];
  const runs=days.map(d=>run(d));
  const result=core.suggest(runs,profile(),{},today);
  assert.equal(result.targetKm,12.6);
  assert.equal(core.suggest(runs.map(r=>({...r,effort:null})),profile(),{},today).targetKm,12);
  assert.ok(core.suggest(runs,profile(),{date:today,feeling:'tired'},today).targetKm<12);
});
test('a past race can be restored but asks for a new goal',()=>{
  const p=core.storedProfile({...profile(),raceDate:'2026-10-01'},today);
  assert.equal(core.suggest([],p,{},today).kind,'setup');
});
test('zero-baseline plan uses run/walk and does not fabricate kilometres',()=>{
  const result=core.suggest([],profile({weeklyKm:0,longestKm:0,currentDays:0,targetDays:5,days:[1,2,3,4,5]}),{},today);
  assert.equal(result.frequency,3);assert.equal(result.targetKm,null);assert.equal(result.next.km,null);
});
test('CSV supports quoted commas/newlines, correct units, walks and effort',()=>{
  const text='Activity ID,Activity Date,Activity Type,Activity Name,Distance,Moving Time,effort,notes\n1,2026-11-01,Run,"Sunday, easy",5,00:30:00,4,"Felt good\nagain"\n2,2026-11-02,Walk,Walk,2,1200,,\n3,2026-11-03,Ride,Ride,40,3600,,\n';
  const rows=core.importCSV(text,'mi',today);
  assert.equal(rows.length,2);assert.equal(rows[0].distanceKm,8.04672);assert.equal(rows[0].seconds,1800);
  assert.equal(rows[0].effort,4);assert.equal(rows[1].sport,'walk');
  assert.equal(core.mergeImported(rows,rows).added,0);
});
const oldWorkout='<Workout workoutActivityType="HKWorkoutActivityTypeRunning" startDate="2026-11-01 10:00:00 +0100" duration="30" durationUnit="min" totalDistance="5" totalDistanceUnit="km" sourceName="Private Watch" />';
const newWorkout='<Workout workoutActivityType="HKWorkoutActivityTypeWalking" startDate="2026-11-02 10:00:00 +0100" duration="1800" durationUnit="s"><WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="3000" unit="m"/><MetadataEntry key="personal" value="private"/></Workout>';
test('Apple Health supports old and new workout distance formats and keeps no raw health metadata',()=>{
  const a=imports.appleWorkout(oldWorkout,today),b=imports.appleWorkout(newWorkout,today);
  assert.equal(a.distanceKm,5);assert.equal(a.seconds,1800);assert.equal(b.distanceKm,3);assert.equal(b.sport,'walk');
  assert.ok(!JSON.stringify(a).includes('Private Watch'));
  assert.ok(!JSON.stringify(b).includes('personal'));
});
test('Apple streaming parser handles tag boundaries and discards unrelated health records',()=>{
  const xml='<HealthData><Record type="private-health-data"/>'+oldWorkout+newWorkout+'</HealthData>';
  const reader=new imports.AppleWorkoutReader(today);
  for(let i=0;i<xml.length;i+=7)reader.push(xml.slice(i,i+7));
  const result=reader.finish();assert.equal(result.runs.length,2);
  assert.equal(core.mergeImported(result.runs,result.runs).duplicates,2);
});
test('Apple import rejects a truncated workout instead of silently saving partial data',()=>{
  const reader=new imports.AppleWorkoutReader(today);reader.push('<Workout workoutActivityType="HKWorkoutActivityTypeRunning">');
  assert.throws(()=>reader.finish());
});
test('streaming file import works without an upload or whole-file text read',async()=>{
  const file=new Blob(['<HealthData>',oldWorkout,newWorkout,'</HealthData>']);
  file.text=()=>{throw new Error('Must stream');};
  const result=await imports.importAppleFile(file);
  assert.equal(result.runs.length,2);
});

test('future plan builds gradually, tapers and ends on race day',()=>{
  const r=core.suggest([],profile({weeklyKm:15,longestKm:7,currentDays:3,raceDate:'2027-03-21'}),{},today);
  const weeks=r.weeks,last=weeks.at(-1);
  assert.equal(weeks[0].start,'2026-11-02');assert.equal(last.phase,'race');assert.equal(weeks.at(-2).phase,'taper');
  assert.equal(last.sessions.at(-1).date,'2027-03-21');assert.ok(last.sessions.at(-1).race);
  assert.equal(r.next,weeks.flatMap(w=>w.sessions)[0]);
  for(let i=2;i<weeks.length;i++){const a=weeks[i-1].sessions.find(s=>s.long),b=weeks[i].sessions.find(s=>s.long);
    if(a&&b&&weeks[i].phase==='build'&&weeks[i-1].phase==='build')assert.ok(b.km-a.km<=1.51,'long run grows at most 1.5 km/week');
    if(weeks[i].phase==='build'&&weeks[i-1].phase==='build')assert.ok(weeks[i].km<=weeks[i-1].km*1.1+.5);}
  assert.ok(weeks.some(w=>w.sessions.some(s=>s.type==='Intervals')));
  assert.ok(Math.max(...weeks.flatMap(w=>w.sessions.filter(s=>s.long).map(s=>s.km)))<=core.GOAL_KM);
  assert.ok(weeks.every(w=>w.sessions.filter(s=>s.quality).length<=1));
});
test('every future week uses exactly the chosen run days, including consecutive days and race week',()=>{
  const r=core.suggest([],profile({weeklyKm:20,longestKm:8,currentDays:3,days:[5,6,0],raceDate:'2027-01-31'}),{},today);
  for(const w of r.weeks.slice(1))assert.equal(w.sessions.length,3,w.start);
  assert.equal(r.weeks[0].sessions.length,3);
  const race=r.weeks.at(-1);assert.ok(race.sessions[0].km>=6);
  const peak=r.weeks.at(-3).sessions.at(-1);assert.equal(peak.km,core.GOAL_KM);assert.equal(r.weeks.at(-2).phase,'taper');
});
test('without a race date the outlook stops at the first 10-mile run; pain shows no plan',()=>{
  const r=core.suggest([],profile({weeklyKm:20,longestKm:8,currentDays:3,targetDays:4,days:[1,3,5,6]}),{},today);
  assert.equal(r.weeks.at(-1).sessions.at(-1).type,'10-mile run');assert.match(r.outlook,/full 10 miles/);
  assert.equal(core.suggest([],profile(),{date:today,feeling:'pain'},today).weeks,undefined);
});
test('beginners progress through run/walk stages before kilometre targets',()=>{
  const r=core.suggest([],profile({weeklyKm:0,longestKm:0,currentDays:0,targetDays:3,days:[1,3,6]}),{},today);
  assert.equal(r.weeks[1].phase,'run-walk');assert.ok(r.weeks.some(w=>w.phase==='build'&&w.sessions.every(s=>s.km!=null)));
});

function boot(raw=null){
  const html=fs.readFileSync('./index.html','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const element=()=>({value:'',textContent:'',innerHTML:'',hidden:false,checked:false,dataset:{},classList:{toggle(){}},addEventListener(){},showModal(){},close(){},reset(){}});
  const nodes=Object.fromEntries(ids.map(id=>[id,element()]));
  for(const id of ['run-form','profile-form']){
    const fragment=html.split(`<form id="${id}"`)[1].split('</form>')[0];
    nodes[id].elements=Object.fromEntries([...fragment.matchAll(/\bname="([^"]+)"/g)].map(m=>[m[1],element()]));
  }
  const dayNodes=[0,1,2,3,4,5,6].map(value=>({...element(),value:String(value),checked:[0,2,4].includes(value)}));
  const sections=['today','log','plan','settings'].map(id=>({...nodes[id],id}));
  const nav=sections.map(s=>({...element(),dataset:{tab:s.id}}));
  const document={getElementById:id=>nodes[id],querySelector:selector=>{const n=nodes[selector.slice(1)];assert.ok(n,'Missing element '+selector);return n;},
    querySelectorAll:selector=>selector==='nav button'?nav:selector==='main>section'?sections:selector==='#days input'?dayNodes:selector==='#days input:checked'?dayNodes.filter(d=>d.checked):[],addEventListener(){},visibilityState:'visible'};
  let stored=raw;
  const context=vm.createContext({...core,...imports,document,window:{scrollTo(){},addEventListener(){}},history:{replaceState(){}},location:{hash:''},navigator:{},
    localStorage:{getItem(){return stored;},setItem(key,value){stored=value;}},crypto:{randomUUID:()=> 'manual-test'},
    setTimeout(){return 1;},clearTimeout(){},alert(){},confirm:()=>true,console,Date,URL,Blob});
  const code=fs.readFileSync('./app.js','utf8').replace(/^import .*$/gm,'');vm.runInContext(code,context);
  return {nodes,context,stored:()=>stored};
}
test('the actual app boots, accepts in-app preferences and persists an activity',()=>{
  const app=boot(),form=app.nodes['profile-form'];
  for(const [k,v]of Object.entries({weeklyKm:'12',longestKm:'5',currentDays:'2',targetDays:'3',raceDate:''}))form.elements[k].value=v;
  form.onsubmit({preventDefault(){},target:form});
  assert.equal(JSON.parse(app.stored()).profile.targetDays,3);
  const f=app.nodes['run-form'];for(const [k,v]of Object.entries({date:core.isoDate(),distanceKm:'5',minutes:'30',title:'Actual run',sport:'run',effort:'4',notes:''}))f.elements[k].value=v;
  f.onsubmit({preventDefault(){},target:f});
  assert.equal(JSON.parse(app.stored()).runs.length,1);
  assert.equal(JSON.parse(app.stored()).runs[0].distanceKm,5);
});
test('unreadable stored data is not overwritten by app startup',()=>{
  const app=boot('{broken');assert.equal(app.stored(),'{broken');assert.equal(vm.runInContext('state.readOnly',app.context),true);
});
test('offline assets, manifest icons and workflow-staged files exist',()=>{
  const worker=fs.readFileSync('./sw.js','utf8');const assets=[...worker.matchAll(/'\.\/([^']*)'/g)].map(m=>m[1]||'index.html');
  for(const name of assets)assert.ok(fs.existsSync('./'+name),name);
  const manifest=JSON.parse(fs.readFileSync('./manifest.webmanifest','utf8'));
  assert.equal(manifest.scope,'./');assert.equal(manifest.start_url,'./');
  for(const icon of manifest.icons)assert.ok(fs.existsSync('./'+icon.src));
});
