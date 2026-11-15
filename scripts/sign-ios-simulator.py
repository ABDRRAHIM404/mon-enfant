#!/usr/bin/env python3
"""Verify simulated Keychain entitlements and ordinary local ad-hoc signatures.
Simulator entitlements belong in Mach-O __TEXT,__entitlements, not the host's
restricted code-signature entitlement blob. Never sign a device/store artifact.
"""
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Simulator verification belongs in GitHub Actions')
app = Path(sys.argv[1]).resolve()
info = plistlib.loads((app/'Info.plist').read_bytes())
assert info['CFBundleIdentifier'] == 'app.monenfant.parent'
assert info.get('CFBundleSupportedPlatforms') == ['iPhoneSimulator']
identifier = info['CFBundleIdentifier']
executable = app/info['CFBundleExecutable']
temp = Path(os.environ['RUNNER_TEMP'])/'simulator-entitlement-proof'
temp.mkdir(exist_ok=True)

def command(args):
    return subprocess.run(args, capture_output=True, check=True).stdout

architectures = command(['xcrun', 'lipo', '-archs', str(executable)]).decode().split()
assert architectures and set(architectures) <= {'arm64', 'x86_64'}
for arch in architectures:
    thin = executable
    if len(architectures) > 1:
        thin = temp/('executable-'+arch)
        command(['xcrun', 'lipo', str(executable), '-thin', arch, '-output', str(thin)])
    extracted = temp/('simulated-'+arch+'.plist')
    command(['xcrun', 'segedit', str(thin), '-extract', '__TEXT', '__entitlements', str(extracted)])
    simulated = plistlib.loads(extracted.read_bytes().rstrip(b'\0'))
    assert simulated.get('application-identifier') == identifier
    assert simulated.get('keychain-access-groups') == [identifier]

restricted = {'application-identifier', 'com.apple.application-identifier', 'keychain-access-groups'}
def signature_entitlements(target):
    result = subprocess.run(['codesign', '-d', '--entitlements', ':-', str(target)], capture_output=True)
    if not result.stdout.strip(): return {}
    return plistlib.loads(result.stdout)

if '--verify-only' not in sys.argv:
    # Keep the Mach-O simulated entitlements unchanged, but never place restricted
    # iOS Keychain entitlements in an unprovisioned macOS host signature.
    empty = temp/'host-empty.plist'
    empty.write_bytes(plistlib.dumps({}))
    for nested in sorted((app/'Frameworks').glob('*')):
        if nested.suffix in ('.framework', '.dylib') and restricted & signature_entitlements(nested).keys():
            command(['codesign', '--force', '--sign', '-', '--entitlements', str(empty), str(nested)])
    if restricted & signature_entitlements(app).keys():
        command(['codesign', '--force', '--sign', '-', '--entitlements', str(empty), str(app)])
assert not restricted & signature_entitlements(app).keys()
command(['codesign', '--verify', '--deep', '--strict', str(app)])
print(json.dumps({'simulated_keychain_entitlements_verified': True, 'native_architectures': architectures, 'restricted_host_entitlements_absent': True, 'distribution_certificate_used': False, 'store_distribution': False}))
