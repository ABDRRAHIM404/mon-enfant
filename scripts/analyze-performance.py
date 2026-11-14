#!/usr/bin/env python3
"""Validate classified cloud artifacts and compare development performance targets.

No credentials or network access. Input paths and unrecognized values are never
included in output. A target comparison is not field or pilot acceptance.
"""
import argparse
import json
import math
from pathlib import Path
import sys

SCREENS = ('registration', 'consultation-form', 'growth-chart',
           'clinical-timeline', 'appointment-form', 'clinical-summary')
DEVICES = ('desktop', 'tablet', 'mobile')
PROFILES = {
    'baseline': (1, 0, -1, -1),
    'constrained': (4, 150, 200000, 93750),
}
# Published good-experience thresholds, used as development targets only.
# https://web.dev/articles/vitals, /fcp and /ttfb. See PERFORMANCE.md.
TARGETS = {'document_ttfb_ms': 800, 'fcp_ms': 1800,
           'lcp_ms': 2500, 'cls': 0.1}
METRICS = (*TARGETS, 'observed_long_task_blocking_ms', 'load_ms',
           'observation_end_ms', 'reported_transfer_bytes', 'resource_count')
FIELDS = {'screen', 'profile', 'cpu_slowdown', 'latency_ms',
          'download_bytes_per_second', 'upload_bytes_per_second',
          'cache_disabled', 'performance_acceptance_claimed', *METRICS}


def analyze(root):
    observations = {}
    files = list(Path(root).rglob('performance-*.json'))
    if len(files) != len(SCREENS) * len(DEVICES):
        raise ValueError('Expected exactly eighteen classified performance files.')
    for path in files:
        device = path.parent.name.rsplit('-', 1)[-1]
        if device not in DEVICES or path.stat().st_size > 65536:
            raise ValueError('Unexpected artifact grouping or size.')
        data = json.loads(path.read_text())
        if not isinstance(data, list) or len(data) != len(PROFILES):
            raise ValueError('Each screen requires both controlled profiles.')
        for proof in data:
            if not isinstance(proof, dict) or set(proof) != FIELDS:
                raise ValueError('Unexpected performance fields.')
            screen, profile = proof['screen'], proof['profile']
            if (not isinstance(screen, str) or screen not in SCREENS
                    or not isinstance(profile, str) or profile not in PROFILES
                    or path.name != 'performance-' + screen + '.json'):
                raise ValueError('Unexpected fixed screen or profile.')
            if (proof['cache_disabled'] is not True
                    or proof['performance_acceptance_claimed'] is not False):
                raise ValueError('Unproven cache or acceptance contract.')
            settings = ('cpu_slowdown', 'latency_ms',
                        'download_bytes_per_second', 'upload_bytes_per_second')
            if any(type(proof[key]) not in (int, float)
                   or proof[key] != expected
                   for key, expected in zip(settings, PROFILES[profile])):
                raise ValueError('Unexpected controlled conditions.')
            if any(type(proof[key]) not in (int, float)
                   or not math.isfinite(proof[key]) or proof[key] < 0
                   for key in METRICS):
                raise ValueError('Unproven finite numeric measurements.')
            if (proof['fcp_ms'] <= 0 or proof['lcp_ms'] <= 0
                    or proof['observation_end_ms'] < max(proof['load_ms'], proof['lcp_ms'])):
                raise ValueError('Unproven paint or observation window.')
            key = (device, screen, profile)
            if key in observations:
                raise ValueError('Duplicate observation cannot establish coverage.')
            observations[key] = proof
    expected = {(device, screen, profile) for device in DEVICES
                for screen in SCREENS for profile in PROFILES}
    if set(observations) != expected:
        raise ValueError('Incomplete device, screen or profile coverage.')
    failures = []
    for (device, screen, profile), proof in sorted(observations.items()):
        for metric, limit in TARGETS.items():
            if proof[metric] > limit:
                failures.append({'viewport': device, 'screen': screen,
                                 'profile': profile, 'metric': metric,
                                 'observed': proof[metric], 'target': limit})
    return {'status': 'targets_missed' if failures else 'targets_met',
            'observations': len(observations), 'samples_per_case': 1,
            'targets': TARGETS, 'failures': failures,
            'maximums': {metric: max(p[metric] for p in observations.values())
                         for metric in METRICS},
            'performance_acceptance_claimed': False,
            'field_compliance_claimed': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', required=True)
    args = parser.parse_args()
    try:
        report = analyze(args.input_dir)
    except Exception:
        print(json.dumps({'status': 'invalid_artifacts',
                          'performance_acceptance_claimed': False}))
        return 2
    print(json.dumps(report, allow_nan=False))
    return 0 if report['status'] == 'targets_met' else 1


if __name__ == '__main__':
    sys.exit(main())
