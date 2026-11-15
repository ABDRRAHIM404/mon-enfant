#!/usr/bin/env python3
"""Cloud-only iOS simulator journey; sensitive automation traces stay runner-private."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import plistlib
import urllib.request
import zipfile

if os.environ.get('GITHUB_ACTIONS') != 'true': raise SystemExit('Native runtime belongs in GitHub Actions')
run = os.environ.get('MON_ENFANT_QA_RUN', '')
assert re.fullmatch('[a-f0-9]{16}', run)
email = os.environ['MON_ENFANT_PARENT_BROWSER_PARENT_EMAIL']
password = os.environ['MON_ENFANT_PARENT_BROWSER_PARENT_PASSWORD']
assert email == f'qa-parent-{run}-parent@example.invalid'
assert re.fullmatch('[A-Za-z0-9_-]+', password)
temp = Path(os.environ['RUNNER_TEMP'])/'mon-enfant-ios-runtime'
temp.mkdir(mode=0o700)
output = Path('test-results/mobile-ios-runtime').resolve()
output.mkdir(parents=True)
proof = json.loads(Path('native-build/build-proof.json').read_text())
assert proof['platform'] == 'ios' and proof['compiled'] and proof['synthetic_only']
assert proof.get('keychain_application_entitlement_verified'), 'Use a native build with verified simulator Keychain entitlements'
stage = 'toolchain'

def command(args, timeout=120):
    return subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout, check=True).stdout

try:
    version = 'cli-2.12.1'
    base = 'https://github.com/mobile-dev-inc/Maestro/releases/download/'+version+'/'
    checksum = urllib.request.urlopen(base+'checksums_sha256.txt', timeout=40).read().decode()
    archive = temp/'maestro.zip'
    urllib.request.urlretrieve(base+'maestro.zip', archive)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert any(line.split()[0] == digest and line.split()[-1].lstrip('*').endswith('maestro.zip') for line in checksum.splitlines() if line.strip())
    command(['unzip', '-q', str(archive), '-d', str(temp/'maestro')])
    cli = list((temp/'maestro').glob('**/bin/maestro'))
    assert len(cli) == 1
    cli[0].chmod(0o700)
    stage = 'simulator-boot'
    devices = json.loads(command(['xcrun', 'simctl', 'list', 'devices', 'available', '-j']))['devices']
    available = [d for values in devices.values() for d in values if d.get('isAvailable') and d['name'].startswith('iPhone')]
    assert available
    device = available[0]
    if device['state'] != 'Booted': command(['xcrun', 'simctl', 'boot', device['udid']])
    command(['xcrun', 'simctl', 'bootstatus', device['udid'], '-b'], timeout=180)
    command(['unzip', '-q', 'native-build/mon-enfant-parent-simulator.zip', '-d', str(temp/'app')])
    apps = list((temp/'app').glob('*.app'))
    assert len(apps) == 1
    stage = 'simulator-local-signature'
    command(['python3', 'scripts/sign-ios-simulator.py', str(apps[0])])
    command(['xcrun', 'simctl', 'install', device['udid'], str(apps[0])])
    stage = 'native-ui-journey'
    flow = []
    def add(command_name, value=None):
        flow.append('- '+command_name+('' if value is None else ': '+json.dumps(value, ensure_ascii=False)))
    def visible(selector): add('extendedWaitUntil', {'visible': selector, 'timeout': 60000})
    def scroll(selector): add('scrollUntilVisible', {'element': selector, 'direction': 'DOWN', 'timeout': 30000})
    def login(remember):
        scroll({'id': 'login-email'})
        add('tapOn', {'id': 'login-email'}); add('inputText', email)
        add('hideKeyboard')
        scroll({'id': 'login-password'})
        add('tapOn', {'id': 'login-password'}); add('inputText', password)
        add('hideKeyboard')
        if remember:
            scroll('Rester connecté sur cet appareil personnel')
            add('tapOn', 'Rester connecté sur cet appareil personnel')
        scroll({'id': 'login-submit'}); add('tapOn', {'id': 'login-submit'})
        visible('Mes enfants')
    add('launchApp')
    visible({'id': 'login-email'})
    add('takeScreenshot', 'ios-login')
    login(False)
    add('takeScreenshot', 'ios-home')
    add('stopApp'); add('launchApp'); visible({'id': 'login-email'})
    login(True)
    add('stopApp'); add('launchApp'); visible('Mes enfants')
    add('tapOn', 'Ouvrir le carnet'); visible('Vaccinations et partage temporaire')
    add('takeScreenshot', 'ios-booklet')
    add('tapOn', 'Vaccinations et partage temporaire')
    visible('Historique des vaccinations')
    add('takeScreenshot', 'ios-vaccinations')
    add('tapOn', 'Retour'); add('tapOn', 'Retour')
    add('tapOn', 'Messages'); visible('Mes notifications')
    add('takeScreenshot', 'ios-notifications')
    add('tapOn', 'Compte'); scroll({'id': 'logout'}); add('tapOn', {'id': 'logout'})
    add('tapOn', 'Se déconnecter'); visible({'id': 'login-email'})
    add('stopApp'); add('launchApp'); visible({'id': 'login-email'})
    target = temp/'journey.yaml'
    target.write_text('appId: app.monenfant.parent\n---\n'+'\n'.join(flow)+'\n')
    target.chmod(0o600)
    private_env = os.environ.copy()
    private_env['MAESTRO_CLI_NO_ANALYTICS'] = '1'
    with (temp/'private-maestro.log').open('wb') as log:
        result = subprocess.run([str(cli[0]), '--device', device['udid'], 'test', '--debug-output', str(temp/'debug'), '--test-output-dir', str(temp/'artifacts'), str(target)], stdout=log, stderr=subprocess.STDOUT, env=private_env, timeout=800)
    for image in (temp/'artifacts').glob('**/ios-*.png'):
        if image.name in {'ios-'+name+'.png' for name in ('login','home','booklet','vaccinations','notifications')}:
            shutil.copyfile(image, output/image.name)
    if result.returncode != 0:
        command(['xcrun', 'simctl', 'io', device['udid'], 'screenshot', str(output/'ios-journey-stop.png')])
        diagnostic = (temp/'private-maestro.log').read_text(errors='replace')
        diagnostic = diagnostic.replace(email, '[synthetic-email]').replace(password, '[redacted]')
        relevant = [line for line in diagnostic.splitlines() if re.search(r'FAIL|Error|Exception|not found|Unable|Assertion|Timed out', line, re.I)]
        print(json.dumps({'native_automation_diagnostic': relevant[-8:], 'sanitized_automation_tail': diagnostic[-4500:]}))
        # Own synthetic app only; classify native launch/loader/signature failures.
        executable = plistlib.loads((apps[0]/'Info.plist').read_bytes())['CFBundleExecutable']
        predicate = 'eventMessage CONTAINS[c] "app.monenfant.parent" OR process == '+json.dumps(executable)
        system = subprocess.run(['xcrun', 'simctl', 'spawn', device['udid'], 'log', 'show', '--last', '3m', '--style', 'compact', '--predicate', predicate], capture_output=True, text=True, timeout=60)
        lines = [line for line in system.stdout.splitlines() if re.search(r'signature|codesign|entitlement|dyld|denied|termination|Library not loaded|EXC_|launch failed|spawn failed', line, re.I)]
        print(json.dumps({'native_launch_diagnostic': '\n'.join(lines)[-6500:]}).replace(email, '[synthetic-email]').replace(password, '[redacted]'))
        reports = Path.home()/'Library/Logs/DiagnosticReports'
        for crash in sorted(reports.glob(executable+'*.ips'))[-2:]:
            try:
                raw = crash.read_text()
                decoder = json.JSONDecoder()
                _, end = decoder.raw_decode(raw)
                body = json.loads(raw[end:].strip())
                print(json.dumps({'native_crash': {key: body.get(key) for key in ('exception', 'termination', 'asi')}}))
            except (ValueError, OSError):
                pass

        raise RuntimeError('Native journey failed')
    result = {'passed': True, 'binary_commit': proof['commit'], 'runtime_commit': os.environ['GITHUB_SHA'], 'fixture_run': run, 'platform': 'iOS Simulator', 'maestro_version': version, 'simulated_keychain_entitlements_verified': True, 'restricted_host_signature_entitlements_absent': True, 'checks': ['native_login_render', 'real_password_login_and_guarded_home', 'session_only_auth_not_restored_after_process_death', 'remembered_auth_restored_after_process_death', 'guardian_child_and_booklet_render', 'native_vaccination_view', 'in_app_notifications_render', 'native_logout_survives_process_restart'], 'synthetic_only': True, 'store_distribution': False, 'fixture_retirement_required': True}
    (output/'runtime-proof.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))
except Exception:
    print(json.dumps({'passed': False, 'failed_stage': stage, 'details_withheld': True, 'fixture_retirement_required': True}))
    raise SystemExit(1) from None
