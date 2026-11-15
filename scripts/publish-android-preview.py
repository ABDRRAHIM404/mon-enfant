#!/usr/bin/env python3
"""Publish the accepted development APK from cloud artifacts, without downloading it to the owner's PC."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('APK publication belongs in GitHub Actions')
repo = os.environ['GITHUB_REPOSITORY']
assert repo == 'ABDRRAHIM404/mon-enfant'
build_run = os.environ['NATIVE_BUILD_RUN']
runtime_run = os.environ['NATIVE_RUNTIME_RUN']
assert re.fullmatch(r'\d+', build_run) and re.fullmatch(r'\d+', runtime_run)

def command(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

assert json.loads(command(['gh', 'api', 'repos/'+repo]))['private'] is True
for run in (build_run, runtime_run):
    info = json.loads(command(['gh', 'api', 'repos/'+repo+'/actions/runs/'+run]))
    assert info['status'] == 'completed' and info['conclusion'] == 'success'
compiled = json.loads(Path('native-build/build-proof.json').read_text())
runtime = json.loads(Path('native-runtime/runtime-proof.json').read_text())
accepted = json.loads(Path('docs/mobile/android-acceptance.json').read_text())
apk = Path('native-build/mon-enfant-parent-development.apk')
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
assert compiled['platform'] == 'android' and compiled['compiled'] is True
assert compiled['synthetic_only'] is True and runtime['synthetic_only'] is True
assert runtime['passed'] is True and compiled['commit'] == runtime['binary_commit']
assert compiled['sha256'] == digest == runtime['apk_sha256'] == accepted['apk_sha256']
assert accepted['fixture_retired'] is True and accepted['fixture_run'] == runtime['fixture_run']
assert str(accepted['build_run']) == build_run and str(accepted['runtime_run']) == runtime_run
required = {'real_password_login_and_guarded_home', 'session_only_auth_not_restored_after_process_death', 'remembered_auth_restored_after_process_death', 'guardian_child_and_booklet_render', 'native_raw_growth_render', 'native_vaccination_view', 'native_qr_decoded_and_scoped_recipient_read', 'native_share_revocation_denies_existing_recipient_session', 'native_guardian_appointment_render', 'in_app_notifications_render', 'native_logout_survives_process_restart'}
assert required <= set(runtime['checks'])
assert re.fullmatch('[a-f0-9]{40}', compiled['commit'])
command(['git', 'fetch', '--no-tags', '--depth=1', 'origin', compiled['commit']])
command(['git', 'diff', '--exit-code', compiled['commit'], 'HEAD', '--', 'mobile', 'src/lib'])
version = json.loads(Path('mobile/package.json').read_text())['version']
assert version == '0.1.0'
tag = 'android-v0.1.0-preview.1'
existing = subprocess.run(['gh', 'release', 'view', tag, '--repo', repo], capture_output=True)
assert existing.returncode != 0, 'Preview already exists; inspect rather than replace published APKs'
release = Path(os.environ['RUNNER_TEMP'])/'android-release'
release.mkdir(mode=0o700)
asset = release/'mon-enfant-parent-0.1.0-preview.1.apk'
shutil.copyfile(apk, asset)
proof = release/'android-acceptance.json'
proof.write_text(json.dumps(accepted, indent=2)+'\n')
notes = release/'release-notes.md'
notes.write_text(f'''Installable **parent Android development preview**, verified with fictional data against the existing Mon Enfant backend.

Includes password sign-in, optional encrypted remembered sessions, linked children/booklet/growth/vaccinations, Casablanca appointments, in-app updates and one-use scoped clinician QR sharing with revocation. Supabase remains responsible for accounts and sessions.

Download `mon-enfant-parent-0.1.0-preview.1.apk` below. Android may ask you to allow installation from your browser. Use the same Mon Enfant account as the website; access to each child still requires its recorded guardian approval.

This preview uses development signing. Physical-device/camera acceptance, final branding/store signing, wider email delivery and qualified clinical/privacy/hosting approvals remain open. iPhone work is deferred at the owner's request.

APK SHA-256: `{digest}`

Binary commit: `{compiled['commit']}`. [Native compilation](https://github.com/{repo}/actions/runs/{build_run}); [Android runtime](https://github.com/{repo}/actions/runs/{runtime_run}). Synthetic fixture retirement is verified in the attached acceptance record.
''')
url = command(['gh', 'release', 'create', tag, str(asset), str(proof), '--repo', repo, '--target', os.environ['GITHUB_SHA'], '--prerelease', '--title', 'Mon Enfant Parent — Android preview 0.1.0', '--notes-file', str(notes)])
print(json.dumps({'published': True, 'release_url': url.strip(), 'apk_sha256': digest, 'development_preview': True, 'store_distribution': False}))
