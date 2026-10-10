<?php
declare(strict_types=1);
function respond(array $data,int $status=200): never {http_response_code($status);echo json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);exit;}
function fail(string $message,int $code=400): never {respond(['error'=>$message],$code);}
function query(PDO $db,string $sql,array $args=[]): PDOStatement {$s=$db->prepare($sql);$s->execute($args);return $s;}
function rateLimit(PDO $db,string $bucket,int $limit,int $period): void {
 $now=time();$key=hash('sha256',$bucket.':'.intdiv($now,$period));
 if($db->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql')query($db,'INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON DUPLICATE KEY UPDATE hits=hits+1',[$key,$now+$period]);
 else query($db,'INSERT INTO rate_limits(bucket,hits,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=hits+1',[$key,$now+$period]);
 if((int)query($db,'SELECT hits FROM rate_limits WHERE bucket=?',[$key])->fetchColumn()>$limit)fail('Zu viele Anfragen. Bitte später erneut versuchen. / Too many requests.',429);
 query($db,'DELETE FROM rate_limits WHERE expires_at < ?',[$now]);
}
function validateDeckData(array $d,array $identities,array $cards): array {
 if(($d['schemaVersion']??null)!==1||!is_string($d['id']??null)||!preg_match('/^[\w-]{1,80}$/D',$d['id'])||!is_string($d['name']??null)||trim($d['name'])===''||strlen($d['name'])>480||!is_string($d['description']??null)||strlen($d['description'])>20000||!is_array($d['entries']??null)||count($d['entries'])>600)throw new InvalidArgumentException('Invalid deck');
 $seen=[];$sum=0;$entries=[];
 foreach($d['entries'] as $e){$p=$e['printingId']??'';$zone=$e['zone']??'';$n=$e['quantity']??null;if(!is_string($p)||!isset($cards[$p])||($identities[$p]??$p)!==($e['cardId']??null)||!in_array($zone,['sovereign','rune','pool','spell','maybe'],true)||!is_int($n)||$n<1||$n>300||isset($seen[$p.':'.$zone]))throw new InvalidArgumentException('Invalid card');$seen[$p.':'.$zone]=true;$sum+=$n;$entries[]=['cardId'=>$e['cardId'],'printingId'=>$p,'zone'=>$zone,'quantity'=>$n];}
 if($sum>600)throw new InvalidArgumentException('Too many cards');
 return ['schemaVersion'=>1,'id'=>$d['id'],'name'=>trim($d['name']),'description'=>$d['description'],'format'=>'free','entries'=>$entries,'trashed'=>(bool)($d['trashed']??false),'updatedAt'=>gmdate('c')];
}
function sendLogin(array $config,string $email,string $token,string $lang): void {
 $link=$config['origin'].'/#/'.$lang.'/account?token='.$token;
 // Only the integration-test harness can use the file transport, never web requests.
 if(isset($config['test_mail_dir'])&&getenv('BLUTBANK_TEST_MODE')==='1'){file_put_contents($config['test_mail_dir'].'/'.hash('sha256',$email).'.txt',$link);return;}
 require_once dirname(__DIR__).'/vendor/autoload.php';
 $mail=new PHPMailer\PHPMailer\PHPMailer(true);$s=$config['smtp'];$mail->isSMTP();$mail->Host=$s['host'];$mail->Port=(int)$s['port'];$mail->SMTPAuth=true;$mail->Username=$s['username'];$mail->Password=$s['password'];$mail->SMTPSecure=$mail->Port===465?'ssl':'tls';$mail->Timeout=15;$mail->CharSet='UTF-8';$mail->setFrom($s['from'],'blutbank');$mail->addAddress($email);$mail->Subject=$lang==='en'?'Your blutbank sign-in link':'Dein blutbank-Anmeldelink';$mail->Body=($lang==='en'?"This link is valid for 15 minutes and can be used once.\n\n":"Dieser Link gilt 15 Minuten und kann einmal verwendet werden.\n\n").$link;$mail->send();
}
