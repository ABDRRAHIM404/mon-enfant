#!/usr/bin/env python3
"""Cloud-only native UI journey. Credentials and UI dumps never enter logs/artifacts."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Native runtime belongs in GitHub Actions')
run = os.environ.get('MON_ENFANT_QA_RUN', '')
assert re.fullmatch('[a-f0-9]{16}', run)
email = os.environ['MON_ENFANT_PARENT_BROWSER_PARENT_EMAIL']
password = os.environ['MON_ENFANT_PARENT_BROWSER_PARENT_PASSWORD']
assert email == f'qa-parent-{run}-parent@example.invalid'
assert re.fullmatch('[A-Za-z0-9_-]+', password)
app = 'app.monenfant.parent'
sdk = Path(os.environ['ANDROID_HOME'])
adb = str(sdk / 'platform-tools/adb')
output = Path('test-results/mobile-runtime')
output.mkdir(parents=True, exist_ok=True)
proof = json.loads(Path('native-build/build-proof.json').read_text())
apk = Path('native-build/mon-enfant-parent-development.apk')
assert proof['platform'] == 'android' and proof['compiled'] and proof['synthetic_only']
assert hashlib.sha256(apk.read_bytes()).hexdigest() == proof['sha256']
stage = 'emulator-start'
checks = []
expected_control = None

def command(args, timeout=30):
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True).stdout

def shell(*args):
    return command([adb, '-s', 'emulator-5554', 'shell', *args])

def nodes():
    shell('uiautomator', 'dump', '/sdcard/mon-enfant-window.xml')
    xml = shell('cat', '/sdcard/mon-enfant-window.xml')
    return list(ET.fromstring(xml).iter('node'))

def find(label, by_id=False, timeout=45, scroll=False):
    global expected_control
    expected_control = label
    until = time.monotonic() + timeout
    while time.monotonic() < until:
        try:
            current_nodes = nodes()
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ET.ParseError):
            time.sleep(1)
            continue
        # Only dismiss a known first-boot SYSTEM launcher ANR, never an app-under-test ANR.
        system_launcher_dialog = any(n.get('resource-id') == 'android:id/alertTitle' and n.get('text') in {"Pixel Launcher isn't responding", "Launcher3 isn't responding"} for n in current_nodes)
        if system_launcher_dialog:
            close = next((n for n in current_nodes if n.get('resource-id') == 'android:id/aerr_close'), None)
            if close is not None:
                bounds = [int(v) for v in re.findall(r'\d+', close.get('bounds', ''))]
                assert len(bounds) == 4
                shell('input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))
                if 'system_launcher_first_boot_dialog_closed' not in checks:
                    checks.append('system_launcher_first_boot_dialog_closed')
                time.sleep(2)
                continue
        for node in current_nodes:
            value = node.get('resource-id', '') if by_id else node.get('text', '')
            matches = value == label or (by_id and value.endswith('/' + label)) or (not by_id and node.get('content-desc', '') == label)
            if matches and node.get('enabled') == 'true':
                return node
        if scroll:
            shell('input', 'swipe', '540', '600' if scroll == 'up' else '1700', '540', '1700' if scroll == 'up' else '600', '350')
        time.sleep(1)
    raise RuntimeError('Expected native control unavailable')

def tap(label, by_id=False, scroll=False):
    node = find(label, by_id, scroll=scroll)
    bounds = [int(v) for v in re.findall(r'\d+', node.get('bounds', ''))]
    assert len(bounds) == 4
    shell('input', 'tap', str((bounds[0]+bounds[2])//2), str((bounds[1]+bounds[3])//2))

def capture(name):
    with (output / (name + '.png')).open('wb') as handle:
        subprocess.run([adb, '-s', 'emulator-5554', 'exec-out', 'screencap', '-p'], stdout=handle, stderr=subprocess.DEVNULL, check=True)

def launch():
    shell('monkey', '-p', app, '-c', 'android.intent.category.LAUNCHER', '1')

def hide_keyboard():
    state = shell('dumpsys', 'input_method')
    if re.search(r'mInputShown=true|mIsInputViewShown=true', state):
        shell('input', 'keyevent', '4')

def login(remember):
    tap('login-email', True)
    shell('input', 'text', email)
    hide_keyboard()
    assert find('login-email', True).get('text') == email
    tap('login-password', True, scroll=True)
    shell('input', 'text', password)
    hide_keyboard()
    if remember:
        tap('Rester connecté sur cet appareil personnel', scroll=True)
    tap('login-submit', True, scroll=True)
    find('Mes enfants')

emulator = None
emulator_log = Path(os.environ['RUNNER_TEMP'])/'mon-enfant-emulator-startup.log'
try:
    emulator = subprocess.Popen([str(sdk/'emulator/emulator'), '-avd', 'mon-enfant-qa', '-no-window', '-no-audio', '-no-boot-anim', '-no-snapshot', '-gpu', 'swiftshader_indirect', '-memory', '3072', '-cores', '2'], stdout=emulator_log.open('wb'), stderr=subprocess.STDOUT)
    command([adb, 'start-server'])
    until = time.monotonic() + 240
    while True:
        if emulator.poll() is not None: raise RuntimeError('Emulator exited before boot')
        try:
            if shell('getprop', 'sys.boot_completed').strip() == '1': break
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass
        if time.monotonic() > until: raise RuntimeError('Emulator boot timed out')
        time.sleep(2)
    shell('settings', 'put', 'global', 'window_animation_scale', '0')
    shell('settings', 'put', 'global', 'transition_animation_scale', '0')
    shell('settings', 'put', 'global', 'animator_duration_scale', '0')
    shell('input', 'keyevent', '82')
    shell('settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1')
    command([adb, '-s', 'emulator-5554', 'install', '-r', str(apk)], timeout=90)
    stage = 'native-launch'
    launch()
    time.sleep(3)
    capture('native-initial-launch')
    find('login-email', True, timeout=90)
    capture('native-login')
    checks.append('native_login_render')
    stage = 'session-only-login'
    login(False)
    capture('native-home')
    checks.append('real_password_login_and_guarded_home')
    stage = 'session-only-process-death'
    shell('am', 'force-stop', app)
    launch()
    find('login-email', True)
    checks.append('session_only_auth_not_restored_after_process_death')
    stage = 'remembered-login'
    login(True)
    shell('am', 'force-stop', app)
    launch()
    find('Mes enfants')
    checks.append('remembered_auth_restored_after_process_death')
    stage = 'children-booklet'
    tap('Enfants')
    find('Mes enfants')
    tap('Consulter le carnet')
    find('Vaccinations et partage temporaire')
    capture('native-booklet')
    checks.append('guardian_child_and_booklet_render')
    stage = 'growth'
    tap('Croissance', scroll=True)
    find('Poids (kg)', scroll=True)
    capture('native-growth')
    checks.append('native_raw_growth_render')
    stage = 'vaccination-history'
    tap('Vaccinations et partage temporaire', scroll='up')
    find('Historique des vaccinations')
    find('Vaccin transcrit fictif', scroll=True)
    capture('native-vaccinations')
    checks.append('native_vaccination_view')
    stage = 'native-qr'
    tap('J’autorise un soignant vérifié à lire ces informations pendant cinq minutes maximum.', scroll=True)
    tap('sharing-create', True, scroll=True)
    find('Révoquer ce code', scroll=True)
    # Active QR bytes flow directly to the decoder, never an uploaded artifact.
    image = subprocess.run([adb, '-s', 'emulator-5554', 'exec-out', 'screencap', '-p'], capture_output=True, check=True).stdout
    decoded = subprocess.run(['node', 'scripts/mobile-qr-runtime.mjs', 'redeem'], input=image, capture_output=True, timeout=50)
    assert decoded.returncode == 0
    checks.append('native_qr_decoded_and_scoped_recipient_read')
    tap('Révoquer ce code')
    find('Afficher mon QR sécurisé', scroll=True)
    command(['node', 'scripts/mobile-qr-runtime.mjs', 'revoked'], timeout=40)
    checks.append('native_share_revocation_denies_existing_recipient_session')
    # Return buttons are explicit and independent of Android gesture navigation.
    shell('input', 'keyevent', '4')
    shell('input', 'keyevent', '4')
    stage = 'calendar'
    tap('Rendez-vous')
    find('Mes rendez-vous')
    find('Consultation fictive mobile', scroll=True)
    capture('native-appointments')
    checks.append('native_guardian_appointment_render')
    stage = 'notifications'
    tap('Messages')
    find('Mes notifications')
    capture('native-notifications')
    checks.append('in_app_notifications_render')
    stage = 'logout'
    tap('Compte')
    tap('logout', True, scroll=True)
    tap('Se déconnecter')
    find('login-email', True)
    shell('am', 'force-stop', app)
    launch()
    find('login-email', True)
    checks.append('native_logout_survives_process_restart')
    result = {'fixture_run': run, 'runtime_commit': os.environ['GITHUB_SHA'], 'binary_commit': proof['commit'], 'apk_sha256': proof['sha256'], 'platform': 'Android API 34 emulator', 'checks': checks, 'passed': True, 'store_distribution': False, 'synthetic_only': True, 'fixture_retirement_required': True}
    (output/'runtime-proof.json').write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result))
except Exception as error:
    if stage not in ('native-launch', 'emulator-start', 'native-qr'):
        try:
            capture('native-journey-stop')
            labels = [{'text': '[input omitted]' if n.get('class') == 'android.widget.EditText' else n.get('text'), 'id': n.get('resource-id'), 'description': n.get('content-desc')} for n in nodes() if n.get('text') or n.get('resource-id') or n.get('content-desc')]
            print(json.dumps({'synthetic_native_labels': labels[-25:]}).replace(password, '[redacted]').replace(email, '[synthetic-email]'))
        except Exception:
            pass
    if stage == 'native-launch':
        # Fresh installation, before entering either credential: safe public render/crash diagnostics.
        try:
            capture('native-initial-launch')
            print(json.dumps({'initial_native_labels': [{'text': n.get('text'), 'id': n.get('resource-id'), 'description': n.get('content-desc')} for n in nodes() if n.get('text') or n.get('resource-id') or n.get('content-desc')][-20:]}))
            print(command([adb, '-s', 'emulator-5554', 'logcat', '-d', '-s', 'AndroidRuntime', 'ReactNativeJS'])[-8000:])
        except Exception:
            pass
    if stage == 'emulator-start' and emulator_log.exists():
        # Emulator startup happens before installing/logging into the app. No Auth/UI data.
        print(emulator_log.read_text(errors='replace')[-8000:])
    print(json.dumps({'expected_control': expected_control, 'error_type': type(error).__name__, 'passed': False, 'failed_stage': stage, 'checks_completed': checks, 'details_withheld': True, 'fixture_retirement_required': True}))
    raise SystemExit(1) from None
finally:
    if emulator is not None:
        emulator.terminate()
