<?php
$mode = $rel === '/tm/users' ? 'users' : 'account';
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
?><!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title><?= $mode ===
'users'
  ? 'Nutzer'
  : 'Account' ?> · Typemill</title>
<style>*{box-sizing:border-box}body{font:16px system-ui;color:#292524;background:#fafaf9;margin:0}nav{display:flex;gap:20px;flex-wrap:wrap;padding:22px max(24px,calc((100vw - 1100px)/2));background:white;border-bottom:1px solid #d6d3d1}a{color:#0f766e}main{max-width:1100px;margin:40px auto;padding:0 24px}h1{font-size:30px;margin:0 0 20px}p{line-height:1.6}.account-actions{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.pill,button{display:inline-block;border:1px solid #a8a29e;border-radius:5px;padding:10px 16px;background:white;color:#0f766e;text-decoration:none;font:inherit;cursor:pointer}.user-admin-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(160px,220px) auto;gap:18px;align-items:center;padding:18px 0;border-bottom:1px solid #d6d3d1}label{overflow-wrap:anywhere}small{display:block;color:#78716c}select,input{font:inherit;padding:10px;min-width:0;max-width:100%}button:disabled,select:disabled{opacity:.65}#user-admin-status{color:#0f766e}@media(max-width:700px){.user-admin-row{grid-template-columns:minmax(0,1fr)}}[hidden]{display:none}</style></head><body>
<nav><a href="/handbuch/tm/content/visual/regeln">Typemill · Inhalte</a><a href="/handbuch/tm/system">System</a><a href="/handbuch/tm/account">Account</a><a href="/handbuch/tm/users">Nutzer</a><a href="/#/de/rules">Frontend ↗</a></nav>
<main><div id="management"><p role="status">Wird geladen …</p></div></main>
<script type="module">
import {mountAccount} from '/deck-online.mjs?v=deck-prefetch-20261028';
import {mountUserAdmin} from '/user-admin.mjs?v=typemill-accounts-20261028';
const root=document.querySelector('#management');
function links(){for(const a of root.querySelectorAll('a[href^="#/"]')){const href=a.getAttribute('href');a.href=href==='#/de/account'?'/handbuch/tm/account':href==='#/de/users'?'/handbuch/tm/users':'/'+href;}}
new MutationObserver(links).observe(root,{childList:true,subtree:true});
<?= $mode === 'users' ? 'await mountUserAdmin(root);' : 'await mountAccount(root,[],"de");' ?>
links();
</script></body></html>