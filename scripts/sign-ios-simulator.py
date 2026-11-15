#!/usr/bin/env python3
"""Local ad-hoc signing for synthetic iPhoneSimulator artifacts only; never a device/store signature."""
import json
import os
from pathlib import Path
import plistlib
import subprocess
import sys

if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Simulator signing belongs in GitHub Actions')
app = Path(sys.argv[1]).resolve()
info = plistlib.loads((app/'Info.plist').read_bytes())
assert info['CFBundleIdentifier'] == 'app.monenfant.parent'
assert info.get('CFBundleSupportedPlatforms') == ['iPhoneSimulator']
# This unprefixed identifier is confined to a disposable simulator. It does not
# claim an Apple development team or qualify this app for device distribution.
identifier = info['CFBundleIdentifier']
entitlements = Path(os.environ['RUNNER_TEMP'])/'mon-enfant-simulator.entitlements.plist'
entitlements.write_bytes(plistlib.dumps({'application-identifier': identifier, 'keychain-access-groups': [identifier]}))
for nested in sorted((app/'Frameworks').glob('*')):
    if nested.suffix in ('.framework', '.dylib'):
        subprocess.run(['codesign', '--force', '--sign', '-', str(nested)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
subprocess.run(['codesign', '--force', '--sign', '-', '--entitlements', str(entitlements), '--generate-entitlement-der', str(app)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
result = subprocess.run(['codesign', '-d', '--entitlements', ':-', str(app)], capture_output=True, check=True)
actual = plistlib.loads(result.stdout)
assert actual['application-identifier'] == identifier and actual['keychain-access-groups'] == [identifier]
print(json.dumps({'simulator_keychain_entitlement_verified': True, 'local_ad_hoc_signature': True, 'distribution_certificate_used': False, 'store_distribution': False}))
