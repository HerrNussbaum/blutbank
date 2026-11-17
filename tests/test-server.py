"""HTTP integration tests, isolated SQLite and file mail transport; no real email."""
import tempfile, shutil, subprocess, os, json, sqlite3, time, urllib.request, urllib.error, http.cookiejar, hashlib, socket
from pathlib import Path
root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='blutbank-api-') as tmp:
    p = Path(tmp)
    (p / 'public/data').mkdir(parents=True)
    (p / 'private').mkdir()
    (p / 'mail').mkdir()
    shutil.copy(root / 'public/api.php', p / 'public/api.php')
    shutil.copy(root / 'private/bootstrap.php', p / 'private/bootstrap.php')
    shutil.copy(root / 'private/card-editor.php', p / 'private/card-editor.php')
    shutil.copy(root / 'private/card-catalog.php', p / 'private/card-catalog.php')
    shutil.copy(root / 'private/card-reminders.php', p / 'private/card-reminders.php')
    shutil.copy(root / 'private/rules-editor.php', p / 'private/rules-editor.php')
    shutil.copy(root / 'private/browser-session.php', p / 'private/browser-session.php')
    for f in ['glossary.json', 'rules-de.json', 'rules-en.json', 'cards.json', 'card-identities.json', 'ability-reminders.json']:
        shutil.copy(root / 'public/data' / f, p / 'public/data' / f)
    db = sqlite3.connect(p / 'test.db')
    db.executescript('CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT UNIQUE,created_at INTEGER);CREATE TABLE login_tokens(token_hash TEXT PRIMARY KEY,email TEXT,expires_at INTEGER);CREATE TABLE decks(id TEXT PRIMARY KEY,user_id TEXT,body TEXT,revision INTEGER DEFAULT 1,share_token TEXT UNIQUE,updated_at INTEGER);CREATE TABLE rate_limits(bucket TEXT PRIMARY KEY,hits INTEGER,expires_at INTEGER);')
    db.executescript('CREATE TABLE card_roles(user_id TEXT PRIMARY KEY,role TEXT);CREATE TABLE card_published(card_id TEXT PRIMARY KEY,body TEXT,revision INTEGER,updated_at INTEGER);CREATE TABLE card_drafts(card_id TEXT PRIMARY KEY,body TEXT,revision INTEGER,base_revision INTEGER,state TEXT,author_id TEXT,source_note TEXT,updated_at INTEGER);CREATE TABLE card_audit(id TEXT PRIMARY KEY,card_id TEXT,action TEXT,actor_id TEXT,before_body TEXT,after_body TEXT,note TEXT,created_at INTEGER);')
    db.close()
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    (p / 'private/config.php').write_text('<?php return ' + "['origin'=>'" + origin + "','dsn'=>'sqlite:" + str(p / 'test.db') + "','user'=>'','password'=>'','app_key'=>'" + 'a' * 64 + "','registration_enabled'=>true,'card_editor_enabled'=>true,'card_admin_emails'=>['a@example.test'],'test_mail_dir'=>'" + str(p / 'mail') + "'];")
    log = open(p / 'php.log', 'w')
    proc = subprocess.Popen(['php', '-S', f'127.0.0.1:{port}', '-t', str(p / 'public')], env={**os.environ, 'BLUTBANK_TEST_MODE': '1'}, stdout=log, stderr=log)

    def client():
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def call(c, action, data=None, csrf='', origin_header=origin):
        req = urllib.request.Request(origin + '/api.php?action=' + (('cards&view=printings' if action=='cards' else action).replace('?', '&')), data=json.dumps(data).encode() if data is not None else None, headers={'Content-Type': 'application/json', 'Origin': origin_header, 'X-CSRF-Token': csrf})
        try:
            r = c.open(req)
            return (r.status, json.load(r))
        except urllib.error.HTTPError as e:
            return (e.code, json.load(e))
    try:
        a = client()
        for _ in range(50):
            try:
                (status, res) = call(a, 'session')
                break
            except urllib.error.URLError:
                time.sleep(0.1)
        assert status == 200, res
        csrf = res['csrf']
        assert res['user'] is None
        assert call(a, 'list')[0] == 401
        assert call(a, 'request-login', {'email': 'a@example.test'}, csrf, 'https://evil.test')[0] == 403
        assert call(a, 'request-login', {'email': 'a@example.test'}, 'wrong')[0] == 403

        def login(c, email):
            csrf = call(c, 'session')[1]['csrf']
            assert call(c, 'request-login', {'email': email}, csrf)[0] == 200
            token = (p / 'mail' / (hashlib.sha256(email.encode()).hexdigest() + '.txt')).read_text().split('token=')[1]
            (status, result) = call(c, 'login', {'token': token}, csrf)
            assert status == 200, result
            assert call(c, 'login', {'token': token}, result['csrf'])[0] == 401
            return result['csrf']
        csrf = login(a, 'a@example.test')
        cards = call(a, 'cards')[1]['cards']
        ids = json.loads((p / 'public/data/card-identities.json').read_text())
        card = cards[0]
        deck = {'schemaVersion': 1, 'id': 'test-deck', 'name': 'Integration deck', 'description': '# Plan\n- Draw cards', 'summary': 'Test summary', 'coverPrintingId': card['id'], 'entries': [{'cardId': ids[card['id']], 'printingId': card['id'], 'zone': 'spell', 'quantity': 2}]}
        assert call(a, 'save', {'deck': deck, 'revision': None, 'expectedUser': 'another-account'}, csrf)[0] == 409
        assert call(a, 'save', {'deck': deck, 'revision': None}, csrf) == (200, {'revision': 1, 'visibility': 'private'})
        saved = call(a, 'list')[1]['decks'][0]['deck']
        assert saved['summary'] == deck['summary'] and saved['coverPrintingId'] == card['id']
        invalid = {**deck, 'coverPrintingId': 'missing'}
        assert call(a, 'save', {'deck': invalid, 'revision': 1}, csrf)[0] == 400
        legacy = {k: v for (k, v) in deck.items() if k not in ['summary', 'coverPrintingId']}
        legacy['id'] = 'legacy-deck'
        assert call(a, 'save', {'deck': legacy, 'revision': None}, csrf)[0] == 200
        assert call(a, 'save', {'deck': deck, 'revision': 0}, csrf)[0] == 409
        assert call(a, 'save', {'deck': deck, 'revision': 1}, csrf) == (200, {'revision': 2, 'visibility': 'private'})
        b = client()
        bcsrf = login(b, 'b@example.test')
        anonymous = client()
        gcsrf = call(anonymous, 'session')[1]['csrf']
        assert call(anonymous, 'list')[0] == 401
        assert call(anonymous, 'save', {'deck': deck, 'revision': 2}, gcsrf)[0] == 401
        assert call(anonymous, 'visibility', {'id': deck['id'], 'visibility': 'public', 'revision': 2}, gcsrf)[0] == 401
        assert call(b, 'list')[1]['decks'] == []
        assert call(b, 'save', {'deck': deck, 'revision': 2}, bcsrf)[0] == 409
        read = lambda client, id: call(client, 'read-deck?id=' + id)
        assert read(anonymous, deck['id'])[0] == 404 and read(b, deck['id'])[0] == 404
        assert read(a, deck['id'])[1]['owned'] is True
        assert read(a, deck['id'])[1]['deck']['visibility'] == 'private'
        assert call(a, 'save', {'deck': {**deck, 'visibility': 'public'}, 'revision': 2}, csrf) == (200, {'revision': 3, 'visibility': 'private'})
        assert read(anonymous, deck['id'])[0] == 404
        toggle = lambda client, csrf, visibility, revision: call(client, 'visibility', {'id': deck['id'], 'visibility': visibility, 'revision': revision}, csrf)
        assert toggle(b, bcsrf, 'public', 3)[0] == 404
        assert toggle(a, csrf, 'everyone', 3)[0] == 400
        assert toggle(a, csrf, 'public', 1)[0] == 409
        assert toggle(a, csrf, 'public', 3) == (200, {'revision': 4, 'visibility': 'public'})
        for viewer in [anonymous, b]:
            (status, public) = read(viewer, deck['id'])
            assert status == 200 and public['owned'] is False
            assert public['deck']['id'] == deck['id'] and public['deck']['name'] == deck['name']
            assert 'revision' not in public and 'user_id' not in public and ('email' not in public)
        assert call(b, 'save', {'deck': deck, 'revision': 4}, bcsrf)[0] == 409
        assert call(a, 'save', {'deck': {**deck, 'name': 'Changed public deck', 'visibility': 'private'}, 'revision': 4}, csrf) == (200, {'revision': 5, 'visibility': 'public'})
        assert read(anonymous, deck['id'])[1]['deck']['name'] == 'Changed public deck'
        legacy_token = 'a' * 64
        db = sqlite3.connect(p / 'test.db')
        db.execute('UPDATE decks SET share_token=? WHERE id=?', (legacy_token, deck['id']))
        db.commit()
        db.close()
        assert call(anonymous, 'read-shared', {'token': legacy_token}, gcsrf)[1]['deck']['id'] == deck['id']
        assert toggle(a, csrf, 'private', 5) == (200, {'revision': 6, 'visibility': 'private'})
        assert read(anonymous, deck['id'])[0] == 404 and read(b, deck['id'])[0] == 404
        assert call(anonymous, 'read-shared', {'token': legacy_token}, gcsrf)[0] == 404
        assert toggle(a, csrf, 'public', 6) == (200, {'revision': 7, 'visibility': 'public'})
        assert read(anonymous, deck['id'])[1]['deck']['id'] == deck['id']
        assert call(anonymous, 'read-shared', {'token': legacy_token}, gcsrf)[0] == 404
        assert call(a, 'share', {'id': deck['id']}, csrf)[0] == 410
        assert call(a, 'save', {'deck': {**deck, 'trashed': True}, 'revision': 7}, csrf) == (200, {'revision': 8, 'visibility': 'private'})
        assert read(anonymous, deck['id'])[0] == 404
        assert read(a, deck['id'])[1]['deck']['trashed'] is True
        assert toggle(a, csrf, 'public', 8)[0] == 409
        copied = {**deck, 'id': 'public-copy', 'visibility': 'public'}
        assert call(a, 'save', {'deck': copied, 'revision': None}, csrf) == (200, {'revision': 1, 'visibility': 'private'})
        assert read(anonymous, copied['id'])[0] == 404
        owner = call(a, 'session')[1]['user']['id']
        deletion = {'decks': [{'id': deck['id'], 'revision': 8}], 'expectedUser': owner}
        assert call(anonymous, 'delete', deletion, gcsrf)[0] == 401
        assert call(a, 'delete', deletion, 'wrong')[0] == 403
        assert call(b, 'delete', {**deletion, 'expectedUser': call(b, 'session')[1]['user']['id']}, bcsrf)[0] == 409
        assert call(a, 'delete', {**deletion, 'expectedUser': 'other-account'}, csrf)[0] == 409
        assert call(a, 'delete', {**deletion, 'decks': [{'id': deck['id'], 'revision': 7}]}, csrf)[0] == 409
        assert call(a, 'delete', {**deletion, 'decks': [{'id': copied['id'], 'revision': 1}]}, csrf)[0] == 409
        assert call(a, 'delete', {**deletion, 'decks': deletion['decks'] + [{'id': 'missing', 'revision': 1}]}, csrf)[0] == 409
        assert read(a, deck['id'])[0] == 200
        another = {**deck, 'id': 'trash-delete-test', 'trashed': True}
        assert call(a, 'save', {'deck': another, 'revision': None}, csrf)[0] == 200
        assert call(a, 'delete', {**deletion, 'decks': [{'id': another['id'], 'revision': 1}]}, csrf) == (200, {'ok': True})
        assert read(a, another['id'])[0] == 404
        assert call(a, 'delete', deletion, csrf) == (200, {'ok': True})
        assert read(a, deck['id'])[0] == 404
        print('Permanent deletion: ownership, CSRF, revision conflicts, active-deck protection and atomic batches passed.')
        deck['entries'][0]['quantity'] = -1
        assert call(a, 'save', {'deck': deck, 'revision': 8}, csrf)[0] == 400
        print('Deck access: one ID, private/public transitions, anonymous read-only access, owners, stale revisions, legacy aliases, trash and private copies passed.')
        guest = client()
        assert call(guest, 'card-queue')[0] == 401
        assert call(b, 'card-queue')[0] == 403
        assert call(b, 'card-users')[0] == 403
        assert any((u['email'] == 'b@example.test' and u['role'] == 'reader' for u in call(a, 'card-users')[1]['users']))
        assert call(a, 'session')[1]['cardPermissions'] == {'edit': True, 'approve': True, 'manage': True, 'access': True}
        assert call(a, 'card-role', {'email': 'b@example.test', 'role': 'editor'}, csrf)[0] == 200
        assert call(b, 'session')[1]['cardPermissions'] == {'edit': True, 'approve': False, 'manage': False, 'access': True}
        c = client()
        ccsrf = login(c, 'c@example.test')
        assert call(a, 'card-role', {'email': 'c@example.test', 'role': 'approver'}, csrf)[0] == 200
        assert call(c, 'session')[1]['cardPermissions'] == {'edit': False, 'approve': True, 'manage': False, 'access': True}
        assert call(c, 'card-users')[0] == 403
        assert call(c, 'card-role', {'email': 'b@example.test', 'role': 'admin'}, ccsrf)[0] == 403
        cid = card['id']
        base = call(guest, 'cards')[1]['cards'][0]
        patch = {'card': {'name': base['name'], 'notes': 'Question?\n\nAnswer.'}, 'text': {'rulesText': 'Draw 3 cards.', 'stats': {'asp': 0}}, 'textReviewed': True, 'infoReviewed': True}
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': patch, 'sourceNote': 'Original card image'}, 'wrong')[0] == 403
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': {'card': {'original': 'https://evil.test'}}, 'sourceNote': 'test'}, bcsrf)[0] == 400
        saved = call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': patch, 'sourceNote': 'Original card image'}, bcsrf)
        assert saved == (200, {'revision': 1}), saved
        queue = call(c, 'card-queue')[1]['drafts']
        assert queue[0]['source_note'] == 'Original card image' and queue[0]['author'] == 'b@example.test'
        dark = '026046c8cba1'
        fix = {'text': {'typeLine': 'Training'}, 'textReviewed': False, 'infoReviewed': False}
        assert call(b, 'card-save', {'id': dark, 'revision': 0, 'patch': fix, 'sourceNote': 'Training, not Sovereign'}, bcsrf)[0] == 200
        corrected = call(b, 'card-load?id=' + dark)[1]['draft']['body']
        assert corrected['text']['typeLine'] == 'Training' and 'types' not in corrected['text'] and (not corrected['text'].get('surcharges'))
        assert call(b, 'card-discard', {'id': dark, 'revision': 1}, bcsrf)[0] == 200
        assert call(guest, 'cards')[1]['cards'][0] == base
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': patch, 'sourceNote': 'test'}, bcsrf)[0] == 409
        assert call(c, 'card-save', {'id': cid, 'revision': 1, 'patch': patch, 'sourceNote': 'test'}, ccsrf)[0] == 403
        assert call(b, 'card-submit', {'id': cid, 'revision': 1}, bcsrf) == (200, {'revision': 2})
        assert call(b, 'card-publish', {'id': cid, 'revision': 2, 'publishedRevision': 0}, bcsrf)[0] == 403
        assert call(b, 'card-discard', {'id': cid, 'revision': 2}, bcsrf)[0] == 409
        assert call(c, 'card-publish', {'id': cid, 'revision': 1, 'publishedRevision': 0}, ccsrf)[0] == 409
        (status, published) = call(c, 'card-publish', {'id': cid, 'revision': 2, 'publishedRevision': 0}, ccsrf)
        assert status == 200, published
        assert published['revision'] == 1
        public = call(guest, 'cards')[1]['cards'][0]
        assert public['text']['rulesText'] == 'Draw 3 cards.' and public['text']['stats']['asp'] == 0
        variants = [x for x in call(guest, 'cards')[1]['cards'] if x.get('gameplayId') == public.get('gameplayId')]
        assert len(variants) > 1
        assert all((x['text']['rulesText'] == 'Draw 3 cards.' and x['text']['stats']['asp'] == 0 for x in variants))
        other = next((x for x in variants if x['id'] != cid))
        assert call(c, 'card-load?id=' + other['id'])[1]['card']['id'] == cid
        assert public['notes'] == 'Question?\n\nAnswer.'
        assert public.get('nameFromFilename') == base.get('nameFromFilename')
        assert call(guest, 'cards-download')[1][0]['versions'][0]['id'] == public['id']
        assert call(guest, 'texts-download')[1][0]['rulesText'] == public['text']['rulesText']
        assert json.loads((p / 'public/data/cards.json').read_text())[0]['text']['rulesText'] == 'Draw 3 cards.'
        history = call(c, 'card-history?id=' + cid)[1]['history']
        event = next((h for h in history if h['action'] == 'publish'))
        assert event['actor'] == 'c@example.test' and event['before']['name'] == base['name']
        (status, result) = call(c, 'card-restore', {'id': cid, 'revision': 0, 'publishedRevision': 1, 'eventId': event['id'], 'note': 'Restore original'}, ccsrf)
        assert status == 200, result
        assert call(guest, 'cards')[1]['cards'][0] == base
        # One canonical card, version CRUD, removed notes and existing deck links.
        loaded = call(b, 'card-load?id=' + cid)[1]
        versions = json.loads(json.dumps(loaded['card']['versions']))
        original_ids = [v['id'] for v in versions]
        versions[0]['image'] = 'https://example.org/updated-card.png'
        new_version = json.loads(json.dumps(versions[0]))
        new_version.update(id='abcdef123456', variant='Additional test printing', image='https://example.org/new-card.png')
        versions.append(new_version)
        patch2 = {'card': {'notes': ''}, 'text': {'typeLine': 'Epic Character, Human', 'rarity': 'L'}, 'versions': versions}
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': patch2, 'sourceNote': 'New printing and removed obsolete erratum'}, bcsrf)[0] == 200
        assert not any(x['id'] == new_version['id'] for x in call(guest, 'cards')[1]['cards'])
        assert call(b, 'card-submit', {'id': cid, 'revision': 1}, bcsrf)[0] == 200
        published2 = call(c, 'card-publish', {'id': cid, 'revision': 2, 'publishedRevision': 2}, ccsrf)
        assert published2[0] == 200, published2
        canonical = call(guest, 'cards&view=catalog')[1]
        assert canonical['schemaVersion'] == 2
        group = next(x for x in canonical['cards'] if x['id'] == base['gameplayId'])
        assert group['notes'] == '' and len(group['versions']) == len(versions), (group['notes'],len(group['versions']),len(versions),[v['id'] for v in group['versions']],len(published2[1]['card'].get('versions',[])),[(x['id'],[v['id'] for v in x['versions']]) for x in canonical['cards'] if any(v['id']=='abcdef123456' for v in x['versions'])])
        assert not any(k in group['text'] for k in ['types', 'subtypes', 'traits'])
        assert group['text']['rarity'] == 'L'
        assert all('rarity' not in v['text'] and 'collectorNumber' not in v['text'] and 'original' not in v for v in group['versions'])
        assert all(x in [v['id'] for v in group['versions']] for x in original_ids)
        assert group['versions'][0]['image'] == 'https://example.org/updated-card.png'
        visible = [x for x in call(guest, 'cards')[1]['cards'] if x['gameplayId'] == group['id']]
        assert all(x['notes'] == '' and x['text']['typeLine'] == 'Epic Character, Human' for x in visible)
        assert call(b, 'card-load?id=' + new_version['id'])[1]['card']['id'] == cid
        new_deck = {**deck, 'id': 'new-printing-deck', 'coverPrintingId': new_version['id'], 'entries': [{'cardId': group['id'], 'printingId': new_version['id'], 'zone': 'spell', 'quantity': 2}]}
        saved_new = call(a, 'save', {'deck': new_deck, 'revision': None}, csrf)
        assert saved_new[0] == 200, (saved_new,new_deck)
        stored = call(a, 'read-deck?id=new-printing-deck')[1]['deck']
        assert stored['entries'][0]['printingId'] == new_version['id']
        bad = json.loads(json.dumps(versions)); bad[0]['image'] = 'javascript:alert(1)'
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': {'versions': bad}, 'sourceNote': 'invalid link'}, bcsrf)[0] == 400
        bad = versions[1:]
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': {'versions': bad}, 'sourceNote': 'must preserve existing printing'}, bcsrf)[0] == 400
        snapshot = json.loads((p / 'public/data/cards.json').read_text())
        assert len([x for x in snapshot if x['id'] == group['id']]) == 1
        deletion_versions = json.loads(json.dumps(group['versions']))
        next(v for v in deletion_versions if v['id'] == new_version['id'])['archived'] = True
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': {'versions': deletion_versions}, 'sourceNote': 'Remove test printing from public selection'}, bcsrf)[0] == 200
        assert call(b, 'card-submit', {'id': cid, 'revision': 1}, bcsrf)[0] == 200
        removed = call(c, 'card-publish', {'id': cid, 'revision': 2, 'publishedRevision': 3}, ccsrf)
        assert removed[0] == 200, removed
        archived = next(x for x in call(guest, 'cards')[1]['cards'] if x['id'] == new_version['id'])
        assert archived['archived'] is True
        assert call(a, 'read-deck?id=new-printing-deck')[1]['deck']['entries'][0]['printingId'] == new_version['id']
        assert call(b, 'card-load?id=' + new_version['id'])[0] == 200
        assert call(a, 'save', {'deck': new_deck, 'revision': 1}, csrf)[0] == 200
        next(v for v in deletion_versions if v['id'] == new_version['id'])['archived'] = False
        assert call(b, 'card-save', {'id': cid, 'revision': 0, 'patch': {'versions': deletion_versions}, 'sourceNote': 'Restore test printing'}, bcsrf)[0] == 200
        assert call(b, 'card-submit', {'id': cid, 'revision': 1}, bcsrf)[0] == 200
        assert call(c, 'card-publish', {'id': cid, 'revision': 2, 'publishedRevision': 4}, ccsrf)[0] == 200
        restored = next(x for x in call(guest, 'cards')[1]['cards'] if x['id'] == new_version['id'])
        assert restored['archived'] is False
        print('Printing removal/restoration preserves old deck references and remains behind editorial approval.')
        print('Canonical catalog: printing edit/add, secure image URLs, removed errata, snapshot and deck reference checks passed.')
        assert call(a, 'card-role', {'email': 'b@example.test', 'role': 'reader'}, csrf)[0] == 200
        assert call(b, 'card-queue')[0] == 403
        assert call(b, 'card-load?id=' + cid)[0] == 403
        assert call(b, 'card-history?id=' + cid)[0] == 403
        assert call(a, 'card-role', {'email': 'a@example.test', 'role': 'reader'}, csrf)[0] == 409
        assert call(c, 'card-publish', {'id': cid, 'revision': 2, 'publishedRevision': 0}, ccsrf)[0] == 409
        print('Card editorial HTTP checks: all four roles, private drafts, CSRF, validation, conflicts, publication, rollback and immediate revocation passed.')
        assert call(anonymous, 'rules-admin')[0] == 403
        assert call(b, 'rules-admin')[0] == 403
        assert call(c, 'rules-admin')[0] == 403
        initial = call(anonymous, 'rules-live')[1]['book']
        legacy_book = {k: v for (k, v) in initial.items() if k != 'glossary'}
        db = sqlite3.connect(p / 'test.db')
        db.execute('INSERT INTO rulebooks(id,generation,body) VALUES(1,0,?)', (json.dumps({'live': legacy_book, 'draft': None, 'archives': []}),))
        db.commit()
        db.close()
        admin = call(a, 'rules-admin')[1]
        assert admin['generation'] == 0 and admin['draft'] is None
        assert admin['live']['languages'] == legacy_book['languages'] and admin['live']['glossary'] == json.loads((p / 'public/data/glossary.json').read_text())
        assert call(b, 'rules-start', {'generation': 0, 'name': 'Secret revision'}, bcsrf)[0] == 403
        (status, work) = call(a, 'rules-start', {'generation': 0, 'name': 'Revision 02'}, csrf)
        assert status == 200, work
        book = work['draft']
        book['languages']['de'][1]['title'] = 'Private working title'
        for language in ['de', 'en']:
            book['languages'][language] = [r for r in book['languages'][language] if r['id'] != '1.4']
            book['languages'][language] += [{'id': 'new-chapter', 'number': '16', 'parent': '', 'title': 'New chapter', 'body': '', 'page': 0}, {'id': 'new-section', 'number': '16.1', 'parent': 'new-chapter', 'title': 'New section', 'body': 'New text', 'page': 0}]
        book['languages']['de'][-1]['delta'] = {'ops': [{'insert': 'Rich', 'attributes': {'strike': True, 'color': '#ff0000', 'font': 'serif', 'size': 'large', 'script': 'super'}}, {'insert': '\n', 'attributes': {'header': 4, 'align': 'center', 'indent': 2}}, {'insert': {'image': 'https://example.test/a.png'}}, {'insert': {'video': 'https://www.youtube.com/embed/test'}}, {'insert': {'formula': 'x^2'}}, {'insert': '\n'}, {'insert': 'Cell'}, {'insert': '\n', 'attributes': {'table': 'row-test'}}, {'insert': '\n'}]}
        assert initial['glossary'] == json.loads((p / 'public/data/glossary.json').read_text())
        book['glossary'][0]['de'] = 'Begriff in Überarbeitung'
        book['glossary'][0]['deDelta'] = {'ops': [{'insert': 'Formatiert', 'attributes': {'background': 'rgba(0, 0, 0, 0)', 'color': 'rebeccapurple', 'bold': False, 'link': '/#/de/rules/1'}}, {'insert': '\n', 'attributes': {'header': '2'}}]}
        book['glossary'].append({'id': 'new-term', 'de': 'Neuer Begriff', 'en': 'New term', 'deText': 'Privater Text', 'enText': 'Private text', 'kind': 'Keyword', 'rule': '1.1', 'aliases': ['Alternative']})
        book['glossary'] = [g for g in book['glossary'] if g['id'] != 'active']
        assert call(a, 'rules-save', {'generation': 0, 'book': book}, csrf)[0] == 409
        (status, work) = call(a, 'rules-save', {'generation': 1, 'bookJson': json.dumps(book)}, csrf)
        assert status == 200, work
        assert work['draft']['languages']['de'][1]['title'] == 'Private working title'
        assert call(a, 'rules-save', {'generation': 2, 'bookJson': '{'}, csrf)[0] == 400
        assert call(a, 'rules-save', {'generation': 2, 'bookJson': []}, csrf)[0] == 400
        assert call(anonymous, 'rules-save', {'generation': 2, 'bookJson': json.dumps(book)}, gcsrf)[0] == 403
        assert call(anonymous, 'rules-live')[1]['book'] == initial
        (p / 'public/data/rules-de.json').write_text('[]')
        assert call(anonymous, 'rules-live')[1]['book'] == initial
        assert call(anonymous, 'rules-publish', {'generation': 2}, gcsrf)[0] == 403
        import copy
        invalid = copy.deepcopy(book)
        invalid['languages']['de'][0]['delta'] = {'ops': [{'insert': 'bad', 'attributes': {'link': 'javascript:alert(1)'}}]}
        assert call(a, 'rules-save', {'generation': 2, 'book': invalid}, csrf)[0] == 400
        for insert in [{'image': 'data:image/svg+xml,evil'}, {'video': 'https://evil.test/embed/x'}, {'formula': {'evil': 'object'}}]:
            invalid = copy.deepcopy(book)
            invalid['languages']['de'][0]['delta'] = {'ops': [{'insert': insert}, {'insert': '\n'}]}
            assert call(a, 'rules-save', {'generation': 2, 'book': invalid}, csrf)[0] == 400
        invalid = copy.deepcopy(book)
        invalid['languages']['de'][1]['parent'] = 'missing'
        assert call(a, 'rules-save', {'generation': 2, 'book': invalid}, csrf)[0] == 400
        assert call(a, 'rules-save', {'generation': 2, 'book': book}, 'wrong')[0] == 403
        (status, published) = call(a, 'rules-publish', {'generation': 2}, csrf)
        assert status == 200, published
        assert published['draft'] is None and published['archives'] == [initial]
        live = call(anonymous, 'rules-live')[1]
        assert live['book']['languages']['de'][1]['title'] == 'Private working title'
        assert set(live) == {'book'} and 'archives' not in live
        assert live['book']['glossary'][0]['de'] == 'Begriff in Überarbeitung'
        assert any((g['id'] == 'new-term' for g in live['book']['glossary']))
        assert not any((g['id'] == 'active' for g in live['book']['glossary']))
        assert published['archives'][0]['glossary'] == initial['glossary']
        (status, restored) = call(a, 'rules-restore', {'generation': 3, 'index': 0}, csrf)
        assert status == 200, restored
        assert restored['draft']['languages'] == initial['languages']
        assert restored['draft']['glossary'] == initial['glossary']
        assert call(anonymous, 'rules-live')[1]['book'] == live['book']
        assert call(a, 'rules-publish', {'generation': 4}, csrf)[0] == 200
        assert call(anonymous, 'rules-live')[1]['book']['languages'] == initial['languages']
        print('Rulebook HTTP: private whole-book drafts, public isolation, admin permissions, conflicts, validation, publication, archives and restoration passed.')
        assert call(a, 'logout', {}, csrf)[0] == 200
        assert call(a, 'list')[0] == 401
        print('PHP HTTP integration: email link, single use, CSRF, origin, ownership, revision conflicts, sharing, revocation and validation passed (SQLite test database).')
    finally:
        proc.terminate()
        proc.wait()
        log.close()
