"""Meaningful response and authorization boundary checks; no provider or game calls."""
import importlib.util
import pathlib
import tempfile
import unittest
import json
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('vision', pathlib.Path(__file__).parents[1] / 'jev-vision-player.py')
vision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vision)


class VisionBoundaries(unittest.TestCase):
    def response(self, **changes):
        answer = {'type': 'choice', 'choice': 'attack', 'confidence': .8, 'probabilities': {'attack': .9, 'stop': .1}}
        answer.update(changes)
        return {'answers': {'action': answer}}

    def test_accepts_bounded_action(self):
        self.assertEqual(vision.validate_answer(self.response(), {'attack': '', 'stop': ''})['choice'], 'attack')

    def test_refuses_unknown_action(self):
        with self.assertRaises(ValueError):
            vision.validate_answer(self.response(choice='debug_kill_all'), {'attack': '', 'stop': ''})

    def test_refuses_nonfinite_confidence(self):
        with self.assertRaises(ValueError):
            vision.validate_answer(self.response(confidence=float('nan')), {'attack': '', 'stop': ''})

    def test_refuses_missing_or_invalid_distribution(self):
        for probabilities in ({'attack': 1}, {'attack': .4, 'stop': .1}, {'attack': float('nan'), 'stop': 0}):
            with self.subTest(probabilities=probabilities), self.assertRaises(ValueError):
                vision.validate_answer(self.response(probabilities=probabilities), {'attack': '', 'stop': ''})

    def test_refuses_transmission_without_authorization(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(ValueError):
            vision.decide(pathlib.Path(folder) / 'missing.png', {}, pathlib.Path(folder) / 'decision.json', False)

    def test_refuses_noncanonical_output_and_oversized_input(self):
        observation = {'goal': 'Win legally', 'visible': '', 'actions': {'attack': 'J', 'stop': 'Pause'}}
        with tempfile.TemporaryDirectory() as folder:
            for filename, value in [('other.json', observation), ('decision-001.json', {**observation, 'visible': 'x' * 24001})]:
                with self.subTest(filename=filename), self.assertRaises(ValueError):
                    vision.decide(pathlib.Path(folder) / 'missing.png', value, pathlib.Path(folder) / filename, True)

    def test_failed_network_reservation_blocks_future_call(self):
        observation = {'goal': 'Win legally', 'visible': '', 'actions': {'attack': 'J', 'stop': 'Pause'}}
        with tempfile.TemporaryDirectory() as folder:
            directory = pathlib.Path(folder)
            with patch.object(vision, 'prepare_image', return_value=(b'jpeg', (280, 280), 'hash')), patch.object(vision, 'credential', return_value='test-only'), patch.object(vision.urllib.request, 'build_opener') as opener:
                opener.return_value.open.side_effect = vision.urllib.error.URLError('test failure')
                with self.assertRaises(ValueError):
                    vision.decide(directory / 'frame.png', observation, directory / 'decision-001.json', True)
                self.assertEqual(json.loads((directory / 'attempt-001.json').read_text())['reservedInputTokens'], 64000)
                with self.assertRaisesRegex(ValueError, 'Unresolved'):
                    vision.decide(directory / 'frame.png', observation, directory / 'decision-002.json', True)
                self.assertEqual(opener.return_value.open.call_count, 1)

    def test_session_lock_prevents_concurrent_calls(self):
        with tempfile.TemporaryDirectory() as folder:
            directory = pathlib.Path(folder)
            (directory / '.jev-session.lock').write_text('other-owner')
            with self.assertRaisesRegex(ValueError, 'locked'):
                vision.decide(directory / 'frame.png', {}, directory / 'decision-001.json', True)
            self.assertEqual((directory / '.jev-session.lock').read_text(), 'other-owner')

    def test_game_result_artifact_is_not_provider_reservation(self):
        observation = {'goal': 'Win legally', 'visible': '', 'actions': {'attack': 'J', 'stop': 'Pause'}}
        with tempfile.TemporaryDirectory() as folder:
            directory = pathlib.Path(folder)
            (directory / 'attempt-2-result.json').write_text('{"rank":"S"}')
            with patch.object(vision, 'prepare_image', side_effect=ValueError('image reached')):
                with self.assertRaisesRegex(ValueError, 'image reached'):
                    vision.decide(directory / 'frame.png', observation, directory / 'decision-001.json', True)

    def test_reserved_budget_stops_before_image_or_network(self):
        observation = {'goal': 'Win legally', 'visible': '', 'actions': {'attack': 'J', 'stop': 'Pause'}}
        with tempfile.TemporaryDirectory() as folder:
            directory = pathlib.Path(folder)
            for n in range(31):
                (directory / f'attempt-{n:03d}.json').write_text(json.dumps({'status': 'completed', 'decision': f'decision-{n:03d}.json', 'reservedInputTokens': 64000}))
            with patch.object(vision, 'prepare_image') as image:
                with self.assertRaisesRegex(ValueError, 'budget exhausted'):
                    vision.decide(directory / 'frame.png', observation, directory / 'decision-031.json', True)
                image.assert_not_called()


if __name__ == '__main__':
    unittest.main()
