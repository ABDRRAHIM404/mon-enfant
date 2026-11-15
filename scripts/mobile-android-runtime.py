#!/usr/bin/env python3
"""Cloud Android journey. Active QR images, credentials and automation traces stay runner-private."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time
import urllib.request

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Native runtime belongs in GitHub Actions')
run = os.environ.get('MON_ENFANT_QA_RUN', '')
assert re.fullmatch('[a-f0-9]{16}', run)
email = os.environ['MON_ENFANT_PARENT_BROWSER_PARENT_EMAIL']
password = os.environ['MON_ENFANT_PARENT_BROWSER_PARENT_PASSWORD']
assert email == f'qa-parent-{run}-parent@example.invalid'
assert re.fullmatch('[A-Za-z0-9_-]+', password)
sdk = Path(os.environ['ANDROID_HOME'])
adb = str(sdk/'platform-tools/adb')
temp = Path(os.environ['RUNNER_TEMP'])/'mon-enfant-android-runtime'
temp.mkdir(mode=0o700)
output = Path('test-results/mobile-runtime')
output.mkdir(parents=True, exist_ok=True)
proof = json.loads(Path('native-build/build-proof.json').read_text())
apk = Path('native-build/mon-enfant-parent-development.apk')
assert proof['platform'] == 'android' and proof['compiled'] and proof['synthetic_only']
assert hashlib.sha256(apk.read_bytes()).hexdigest() == proof['sha256']
app = 'app.monenfant.parent'
stage = 'toolchain'
checks = []
emulator = None
safe_images = {name+'.png' for name in ('native-login', 'native-home', 'native-booklet', 'native-growth', 'native-vaccinations', 'native-sharing-revoked', 'native-appointments', 'native-notifications')}

def command(args, timeout=60):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True).stdout

def shell(*args):
    return command([adb, '-s', 'emulator-5554', 'shell', *args])

def add(flow, name, value=None):
    flow.append('- '+name+('' if value is None else ': '+json.dumps(value, ensure_ascii=False)))

def visible(flow, selector):
    add(flow, 'extendedWaitUntil', {'visible': selector, 'timeout': 60000})

def scroll(flow, selector, direction='DOWN'):
    add(flow, 'scrollUntilVisible', {'element': selector, 'direction': direction, 'timeout': 30000, 'visibilityPercentage': 100, 'centerElement': True})

def tap(flow, selector):
    add(flow, 'tapOn', selector)

def login(flow, remember):
    scroll(flow, {'id': 'login-email'})
    tap(flow, {'id': 'login-email'}); add(flow, 'inputText', email); add(flow, 'hideKeyboard')
    scroll(flow, {'id': 'login-password'})
    tap(flow, {'id': 'login-password'}); add(flow, 'inputText', password); add(flow, 'hideKeyboard')
    if remember:
        scroll(flow, 'Rester connecté sur cet appareil personnel')
        tap(flow, 'Rester connecté sur cet appareil personnel')
    scroll(flow, {'id': 'login-submit'}); tap(flow, {'id': 'login-submit'})
    visible(flow, 'Mes enfants')

def execute(cli, name, flow):
    target = temp/(name+'.yaml')
    target.write_text('appId: '+app+'\n---\n'+'\n'.join(flow)+'\n')
    target.chmod(0o600)
    artifacts = temp/(name+'-artifacts')
    env = os.environ.copy(); env['MAESTRO_CLI_NO_ANALYTICS'] = '1'
    with (temp/(name+'.log')).open('wb') as log:
        result = subprocess.run([str(cli), '--device', 'emulator-5554', 'test', '--test-output-dir', str(artifacts), '--debug-output', str(temp/(name+'-debug')), str(target)], stdout=log, stderr=subprocess.STDOUT, env=env, timeout=660)
    for image in artifacts.glob('**/*.png'):
        if image.name in safe_images:
            shutil.copyfile(image, output/image.name)
    if result.returncode != 0:
        diagnostic = (temp/(name+'.log')).read_text(errors='replace').replace(email, '[synthetic-email]').replace(password, '[redacted]')
        diagnostic = re.sub(r'(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])', '[token-redacted]', diagnostic)
        print(json.dumps({'native_automation_phase': name, 'sanitized_automation_tail': diagnostic[-5000:]}), flush=True)
        raise RuntimeError('Native UI journey failed')
    return artifacts

try:
    base = 'https://github.com/mobile-dev-inc/Maestro/releases/download/cli-2.12.1/'
    checksum = urllib.request.urlopen(base+'checksums_sha256.txt', timeout=40).read().decode()
    archive = temp/'maestro.zip'
    urllib.request.urlretrieve(base+'maestro.zip', archive)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert any(line.split()[0] == digest and line.split()[-1].lstrip('*').endswith('maestro.zip') for line in checksum.splitlines() if line.strip())
    command(['unzip', '-q', str(archive), '-d', str(temp/'maestro')])
    candidates = list((temp/'maestro').glob('**/bin/maestro'))
    assert len(candidates) == 1
    cli = candidates[0]; cli.chmod(0o700)
    stage = 'emulator-start'
    startup = (temp/'emulator.log').open('wb')
    emulator = subprocess.Popen([str(sdk/'emulator/emulator'), '-avd', 'mon-enfant-qa', '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot', '-gpu', 'swiftshader_indirect', '-memory', '3072', '-cores', '2'], stdout=startup, stderr=subprocess.STDOUT)
    command([adb, 'start-server'])
    until = time.monotonic()+240
    while True:
        if emulator.poll() is not None: raise RuntimeError('Emulator exited before boot')
        try:
            if shell('getprop', 'sys.boot_completed').strip() == '1': break
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass
        if time.monotonic() > until: raise RuntimeError('Emulator boot timed out')
        time.sleep(2)
    shell('wm', 'size', '720x1600'); shell('wm', 'density', '280')
    for scale in ('window_animation_scale', 'transition_animation_scale', 'animator_duration_scale'):
        shell('settings', 'put', 'global', scale, '0')
    shell('input', 'keyevent', '82')
    shell('settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1')
    command([adb, '-s', 'emulator-5554', 'install', '-r', str(apk)], timeout=90)
    stage = 'native-login-records-qr'
    flow = []
    add(flow, 'launchApp')
    add(flow, 'runFlow', {'when': {'visible': "(Quickstep|Pixel Launcher|Launcher3) isn't responding"}, 'commands': [{'tapOn': 'Close app'}]})
    visible(flow, {'id': 'login-email'})
    add(flow, 'takeScreenshot', 'native-login')
    login(flow, False)
    add(flow, 'takeScreenshot', 'native-home')
    add(flow, 'stopApp'); add(flow, 'launchApp'); visible(flow, {'id': 'login-email'})
    login(flow, True)
    add(flow, 'stopApp'); add(flow, 'launchApp'); visible(flow, 'Mes enfants')
    tap(flow, 'Enfants.*'); visible(flow, 'Mes enfants')
    tap(flow, 'Consulter le carnet'); visible(flow, 'Vaccinations et partage temporaire')
    add(flow, 'takeScreenshot', 'native-booklet')
    scroll(flow, 'Croissance'); tap(flow, 'Croissance')
    scroll(flow, 'Poids \\(kg\\)'); add(flow, 'takeScreenshot', 'native-growth')
    scroll(flow, 'Vaccinations et partage temporaire', 'UP'); tap(flow, 'Vaccinations et partage temporaire')
    visible(flow, 'Historique des vaccinations')
    scroll(flow, 'Vaccin transcrit fictif'); add(flow, 'takeScreenshot', 'native-vaccinations')
    consent = 'J’autorise un soignant vérifié à lire ces informations pendant cinq minutes maximum.'
    scroll(flow, consent); tap(flow, consent)
    scroll(flow, {'id': 'sharing-create'}); tap(flow, {'id': 'sharing-create'})
    scroll(flow, 'Révoquer ce code')
    add(flow, 'takeScreenshot', 'qr-private')
    private_artifacts = execute(cli, 'records-and-qr', flow)
    checks.extend(['native_login_render', 'real_password_login_and_guarded_home', 'session_only_auth_not_restored_after_process_death', 'remembered_auth_restored_after_process_death', 'guardian_child_and_booklet_render', 'native_raw_growth_render', 'native_vaccination_view'])
    stage = 'private-native-qr-redemption'
    images = list(private_artifacts.glob('**/qr-private.png'))
    assert len(images) == 1
    with images[0].open('rb') as image:
        result = subprocess.run(['node', 'scripts/mobile-qr-runtime.mjs', 'redeem'], stdin=image, capture_output=True, timeout=50)
    images[0].unlink()
    assert result.returncode == 0
    checks.append('native_qr_decoded_and_scoped_recipient_read')
    stage = 'native-share-revocation'
    flow = []
    scroll(flow, 'Révoquer ce (code|partage)'); tap(flow, 'Révoquer ce (code|partage)')
    visible(flow, 'Partage révoqué.*')
    add(flow, 'takeScreenshot', 'native-sharing-revoked')
    execute(cli, 'share-revocation', flow)
    command(['node', 'scripts/mobile-qr-runtime.mjs', 'revoked'], timeout=40)
    checks.append('native_share_revocation_denies_existing_recipient_session')
    stage = 'calendar-notifications-logout'
    flow = []
    scroll(flow, 'Retour', 'UP'); tap(flow, 'Retour')
    visible(flow, 'Vaccinations et partage temporaire')
    scroll(flow, 'Retour', 'UP'); tap(flow, 'Retour'); visible(flow, 'Mes enfants')
    tap(flow, 'Rendez-vous.*'); visible(flow, 'Mes rendez-vous')
    scroll(flow, 'Consultation fictive mobile'); add(flow, 'takeScreenshot', 'native-appointments')
    tap(flow, 'Messages.*'); visible(flow, 'Mes notifications')
    add(flow, 'takeScreenshot', 'native-notifications')
    tap(flow, 'Compte.*'); scroll(flow, {'id': 'logout'}); tap(flow, {'id': 'logout'})
    tap(flow, {'id': 'android:id/button1'})
    visible(flow, {'id': 'login-email'})
    add(flow, 'stopApp'); add(flow, 'launchApp'); visible(flow, {'id': 'login-email'})
    execute(cli, 'calendar-and-logout', flow)
    checks.extend(['native_guardian_appointment_render', 'in_app_notifications_render', 'native_logout_survives_process_restart'])
    result = {'fixture_run': run, 'runtime_commit': os.environ['GITHUB_SHA'], 'binary_commit': proof['commit'], 'apk_sha256': proof['sha256'], 'platform': 'Android API 34 emulator', 'maestro_version': 'cli-2.12.1', 'checks': checks, 'passed': True, 'store_distribution': False, 'synthetic_only': True, 'fixture_retirement_required': True}
    (output/'runtime-proof.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result), flush=True)
except Exception as error:
    print(json.dumps({'passed': False, 'failed_stage': stage, 'error_type': type(error).__name__, 'checks_completed': checks, 'details_withheld': True, 'fixture_retirement_required': True}), flush=True)
    raise SystemExit(1) from None
finally:
    if emulator is not None: emulator.terminate()
