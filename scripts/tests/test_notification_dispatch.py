import importlib.util
import json
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('dispatch_notifications',Path(__file__).parents[1]/'dispatch-notifications.py')
dispatch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(dispatch)
GOOD=dict(status='completed',claimed=1,accepted=1,retry=0,failed=0,needs_review=0,unacknowledged=0)


class NotificationDispatchTests(unittest.TestCase):
    def test_only_classified_counts_are_returned(self):
        self.assertEqual(dispatch.validate(200,{'Cache-Control':'private, no-store'},json.dumps(GOOD).encode()),GOOD)

    def test_unknown_details_incomplete_counts_and_false_numeric_values_fail(self):
        for data in ({**GOOD,'private_body':'must remain private'}, {**GOOD,'accepted':0}, {**GOOD,'claimed':True}, {**GOOD,'needs_review':1}):
            with self.assertRaises(ValueError): dispatch.validate(200,{'Cache-Control':'no-store'},json.dumps(data).encode())

    def test_cached_failed_or_oversized_responses_cannot_pass(self):
        for status,headers,body in ((503,{'Cache-Control':'no-store'},json.dumps(GOOD).encode()),(200,{},json.dumps(GOOD).encode()),(200,{'Cache-Control':'no-store'},b'x'*4097)):
            with self.assertRaises(ValueError): dispatch.validate(status,headers,body)
