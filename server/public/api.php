<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
require dirname(__DIR__).'/private/bootstrap.php';
set_exception_handler(function(Throwable $e){error_log('blutbank API: '.get_class($e));fail('Server nicht verfügbar. / Server unavailable.',503);});
$configPath=dirname(__DIR__).'/private/config.php';if(!is_file($configPath))fail('Online-Konten noch nicht eingerichtet. / Online accounts not configured.',503);$config=require $configPath;
$test=getenv('BLUTBANK_TEST_MODE')==='1';if(!$test&&($_SERVER['HTTPS']??'')!=='on')fail('HTTPS required',400);
if(strlen($config['app_key']??'')<32)fail('Server configuration incomplete',503);
ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');session_name('blutbank_session');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!$test,'httponly'=>true,'samesite'=>'Lax']);session_start();
if(isset($_SESSION['active'])&&time()-$_SESSION['active']>43200){$_SESSION=[];session_regenerate_id(true);}$_SESSION['active']=time();$_SESSION['csrf']??=bin2hex(random_bytes(32));
$action=$_GET['action']??'session';$post=$_SERVER['REQUEST_METHOD']==='POST';$data=[];
if($post){if(($_SERVER['HTTP_ORIGIN']??'')!==$config['origin'])fail('Invalid origin',403);if(!hash_equals($_SESSION['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??''))fail('Invalid session token',403);if(!str_starts_with($_SERVER['CONTENT_TYPE']??'','application/json'))fail('JSON required',415);$raw=file_get_contents('php://input',false,null,0,300001);if(strlen($raw)>300000)fail('Request too large',413);try{$data=json_decode($raw,true,32,JSON_THROW_ON_ERROR);}catch(Throwable){fail('Invalid JSON');}if(!is_array($data))fail('Invalid request');}
if(!in_array($action,['session','list'],true)&&!$post)fail('POST required',405);
$db=new PDO($config['dsn'],$config['user'],$config['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$user=null;if(isset($_SESSION['uid']))$user=query($db,'SELECT id,email FROM users WHERE id=?',[$_SESSION['uid']])->fetch()?:null;
if($action==='session')respond(['user'=>$user,'csrf'=>$_SESSION['csrf']]);
if($action==='request-login'){
 if(!$config['registration_enabled'])fail('Anmeldung wird noch eingerichtet. / Sign-in is not enabled yet.',503);
 $email=strtolower(trim((string)($data['email']??'')));if(strlen($email)>254||!filter_var($email,FILTER_VALIDATE_EMAIL))fail('Invalid email');
 $ip=$_SERVER['REMOTE_ADDR']??'';rateLimit($db,hash_hmac('sha256','ip:'.$ip,$config['app_key']),15,3600);rateLimit($db,hash_hmac('sha256','email:'.$email,$config['app_key']),3,900);
 query($db,'DELETE FROM login_tokens WHERE expires_at < ?',[time()]);$token=bin2hex(random_bytes(32));$hash=hash('sha256',$token);query($db,'INSERT INTO login_tokens(token_hash,email,expires_at) VALUES(?,?,?)',[$hash,$email,time()+900]);
 try{sendLogin($config,$email,$token,($data['lang']??'de')==='en'?'en':'de');}catch(Throwable $e){query($db,'DELETE FROM login_tokens WHERE token_hash=?',[$hash]);error_log('blutbank SMTP delivery failed');fail('E-Mail konnte nicht versendet werden. Bitte später versuchen. / Email delivery failed.',503);}respond(['ok'=>true]);
}
if($action==='login'){
 rateLimit($db,hash_hmac('sha256','token:'.($_SERVER['REMOTE_ADDR']??''),$config['app_key']),30,900);$token=$data['token']??'';if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))fail('Invalid or expired link',401);
 $hash=hash('sha256',$token);$db->beginTransaction();$row=query($db,'SELECT email FROM login_tokens WHERE token_hash=? AND expires_at>?',[$hash,time()])->fetch();if(!$row){$db->rollBack();fail('Link ungültig oder abgelaufen. / Link invalid or expired.',401);}
 if(query($db,'DELETE FROM login_tokens WHERE token_hash=?',[$hash])->rowCount()!==1){$db->rollBack();fail('Link already used',401);}
 $u=query($db,'SELECT id,email FROM users WHERE email=?',[$row['email']])->fetch();if(!$u){$u=['id'=>bin2hex(random_bytes(16)),'email'=>$row['email']];query($db,'INSERT INTO users(id,email,created_at) VALUES(?,?,?)',[$u['id'],$u['email'],time()]);}$db->commit();session_regenerate_id(true);$_SESSION['uid']=$u['id'];$_SESSION['csrf']=bin2hex(random_bytes(32));respond(['user'=>$u,'csrf'=>$_SESSION['csrf']]);
}
if($action==='read-shared'){$token=$data['token']??'';if(!is_string($token)||!preg_match('/^[a-f0-9]{64}$/D',$token))fail('Not found',404);$body=query($db,'SELECT body FROM decks WHERE share_token=?',[$token])->fetchColumn();if(!$body)fail('Deck nicht verfügbar. / Deck unavailable.',404);$deck=json_decode($body,true);if($deck['trashed'])fail('Deck unavailable',404);respond(['deck'=>$deck]);}
if(!$user)fail('Bitte zuerst anmelden. / Please sign in first.',401);
if($action==='logout'){$_SESSION=[];session_regenerate_id(true);respond(['ok'=>true]);}
if($action==='list'){$rows=query($db,'SELECT body,revision FROM decks WHERE user_id=? ORDER BY updated_at DESC',[$user['id']])->fetchAll();respond(['decks'=>array_map(fn($r)=>['deck'=>json_decode($r['body'],true),'revision'=>(int)$r['revision']],$rows)]);}
if($action==='save'){
 $cards=json_decode(file_get_contents(__DIR__.'/data/cards.json'),true,512,JSON_THROW_ON_ERROR);$ids=json_decode(file_get_contents(__DIR__.'/data/card-identities.json'),true,512,JSON_THROW_ON_ERROR);try{$deck=validateDeckData($data['deck']??[],$ids,array_column($cards,null,'id'));}catch(Throwable){fail('Ungültige Deckdaten. / Invalid deck data');}
 $body=json_encode($deck,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);$id=$deck['id'];$existing=query($db,'SELECT revision,user_id FROM decks WHERE id=?',[$id])->fetch();
 if($existing){if($existing['user_id']!==$user['id'])fail('Deck ID unavailable',409);$rev=$data['revision']??null;if(!is_int($rev))fail('Online-Version geändert. Als neues Deck kopieren oder erneut laden. / Online version conflict.',409);$s=query($db,'UPDATE decks SET body=?,revision=revision+1,updated_at=?,share_token=CASE WHEN ?=1 THEN NULL ELSE share_token END WHERE id=? AND user_id=? AND revision=?',[$body,time(),$deck['trashed']?1:0,$id,$user['id'],$rev]);if(!$s->rowCount())fail('Online-Version geändert. Lokale Daten bleiben erhalten. / Online version conflict; local data retained.',409);respond(['revision'=>$rev+1]);}
 if((int)query($db,'SELECT COUNT(*) FROM decks WHERE user_id=?',[$user['id']])->fetchColumn()>=200)fail('Maximum 200 online decks',409);
 query($db,'INSERT INTO decks(id,user_id,body,updated_at) VALUES(?,?,?,?)',[$id,$user['id'],$body,time()]);respond(['revision'=>1]);
}
if(in_array($action,['share','unshare'],true)){$id=$data['id']??'';if(!is_string($id))fail('Invalid ID');$row=query($db,'SELECT body FROM decks WHERE id=? AND user_id=?',[$id,$user['id']])->fetch();if(!$row)fail('Not found',404);if(json_decode($row['body'],true)['trashed'])fail('Restore deck before sharing',409);$token=$action==='share'?bin2hex(random_bytes(32)):null;query($db,'UPDATE decks SET share_token=? WHERE id=? AND user_id=?',[$token,$id,$user['id']]);respond(['token'=>$token]);}
fail('Unknown action',404);
