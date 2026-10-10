"""HTTP integration tests, isolated SQLite and file mail transport; no real email."""
import tempfile,shutil,subprocess,os,json,sqlite3,time,urllib.request,urllib.error,http.cookiejar,hashlib,socket
from pathlib import Path
root=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='blutbank-api-') as tmp:
 p=Path(tmp);(p/'public/data').mkdir(parents=True);(p/'private').mkdir();(p/'mail').mkdir()
 shutil.copy(root/'server/public/api.php',p/'public/api.php');shutil.copy(root/'server/private/bootstrap.php',p/'private/bootstrap.php')
 for f in ['cards.json','card-identities.json']:shutil.copy(root/'dist/data'/f,p/'public/data'/f)
 db=sqlite3.connect(p/'test.db');db.executescript('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,created_at INTEGER);CREATE TABLE login_tokens(token_hash TEXT PRIMARY KEY,email TEXT,expires_at INTEGER);CREATE TABLE decks(id TEXT PRIMARY KEY,user_id TEXT,body TEXT,revision INTEGER DEFAULT 1,share_token TEXT UNIQUE,updated_at INTEGER);CREATE TABLE rate_limits(bucket TEXT PRIMARY KEY,hits INTEGER,expires_at INTEGER);');db.close()
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 origin=f'http://127.0.0.1:{port}';(p/'private/config.php').write_text("<?php return "+"['origin'=>'"+origin+"','dsn'=>'sqlite:"+str(p/'test.db')+"','user'=>'','password'=>'','app_key'=>'"+'a'*64+"','registration_enabled'=>true,'test_mail_dir'=>'"+str(p/'mail')+"'];")
 log=open(p/'php.log','w');proc=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(p/'public')],env={**os.environ,'BLUTBANK_TEST_MODE':'1'},stdout=log,stderr=log)
 def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(c,action,data=None,csrf='',origin_header=origin):
  req=urllib.request.Request(origin+'/api.php?action='+action,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':origin_header,'X-CSRF-Token':csrf})
  try:r=c.open(req);return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
 try:
  a=client()
  for _ in range(50):
   try:status,res=call(a,'session');break
   except urllib.error.URLError:time.sleep(.1)
  assert status==200,res;csrf=res['csrf'];assert res['user'] is None
  assert call(a,'list')[0]==401
  assert call(a,'request-login',{'email':'a@example.test'},csrf,'https://evil.test')[0]==403
  assert call(a,'request-login',{'email':'a@example.test'},'wrong')[0]==403
  def login(c,email):
   csrf=call(c,'session')[1]['csrf'];assert call(c,'request-login',{'email':email},csrf)[0]==200
   token=(p/'mail'/(hashlib.sha256(email.encode()).hexdigest()+'.txt')).read_text().split('token=')[1]
   status,result=call(c,'login',{'token':token},csrf);assert status==200,result
   assert call(c,'login',{'token':token},result['csrf'])[0]==401
   return result['csrf']
  csrf=login(a,'a@example.test');cards=json.loads((p/'public/data/cards.json').read_text());ids=json.loads((p/'public/data/card-identities.json').read_text());card=cards[0]
  deck={'schemaVersion':1,'id':'test-deck','name':'Integration deck','description':'','entries':[{'cardId':ids[card['id']],'printingId':card['id'],'zone':'spell','quantity':2}]}
  assert call(a,'save',{'deck':deck,'revision':None},csrf)==(200,{'revision':1})
  assert call(a,'save',{'deck':deck,'revision':0},csrf)[0]==409
  assert call(a,'save',{'deck':deck,'revision':1},csrf)==(200,{'revision':2})
  b=client();bcsrf=login(b,'b@example.test');assert call(b,'list')[1]['decks']==[];assert call(b,'save',{'deck':deck,'revision':2},bcsrf)[0]==409;assert call(b,'share',{'id':deck['id']},bcsrf)[0]==404
  share=call(a,'share',{'id':deck['id']},csrf)[1]['token'];assert call(b,'read-shared',{'token':share},bcsrf)[1]['deck']['name']=='Integration deck'
  assert call(a,'unshare',{'id':deck['id']},csrf)[0]==200;assert call(b,'read-shared',{'token':share},bcsrf)[0]==404
  deck['entries'][0]['quantity']=-1;assert call(a,'save',{'deck':deck,'revision':2},csrf)[0]==400
  assert call(a,'logout',{},csrf)[0]==200;assert call(a,'list')[0]==401
  print('PHP HTTP integration: email link, single use, CSRF, origin, ownership, revision conflicts, sharing, revocation and validation passed (SQLite test database).')
 finally:proc.terminate();proc.wait();log.close()
