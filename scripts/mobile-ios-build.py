#!/usr/bin/env python3
"""Compile only on the GitHub macOS runner; no Apple account, signing key or EAS service."""
import os,subprocess
from pathlib import Path
if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('Native compilation belongs in GitHub Actions')
root=Path('mobile/ios');workspaces=list(root.glob('*.xcworkspace'));projects=list(root.glob('*.xcodeproj'))
if len(workspaces)!=1 or len(projects)!=1:raise RuntimeError('Expected one generated iOS application workspace')
output=Path(os.environ['RUNNER_TEMP'])/'mon-enfant-ios-build'
subprocess.run(['xcodebuild','-workspace',str(workspaces[0]),'-scheme',projects[0].stem,'-configuration','Release','-sdk','iphonesimulator','-destination','generic/platform=iOS Simulator','-derivedDataPath',str(output),'CODE_SIGNING_ALLOWED=YES','CODE_SIGN_IDENTITY=-','CODE_SIGNING_REQUIRED=YES','COMPILER_INDEX_STORE_ENABLE=NO'],check=True)

apps=list((output/'Build/Products/Release-iphonesimulator').glob('*.app'))
assert len(apps)==1
subprocess.run(['python3','scripts/sign-ios-simulator.py',str(apps[0])],check=True)
