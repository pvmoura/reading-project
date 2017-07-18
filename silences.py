#! /usr/bin/python 

import audioop, wave, os, sys, json, contextlib, numpy
#DIR = '/home/pedro/Dropbox/Exquisite_Corpse/short_samples/20160522_109_jody_azzouni_1.wav'
#DIR = '/home/pedro/Dropbox/Exquisite_Corpse/Sample audio 060217/'
DIR = "/Users/readingspeaks/Dropbox/Exquisite_Corpse/short_samples/20160521_096_daniel_browne.wav"
DIR = "/Users/readingspeaks/Dropbox/Exquisite_Corpse/short_samples/CONF-1_S003_S003_T002_1.wav"
DIR = "/Users/readingspeaks/Dropbox/Exquisite_Corpse/short_samples/20160522_122_michael_levine.wav"
DIR = "/Users/pedrovmoura/Dropbox/Exquisite_Corpse/short_samples/20160522_122_michael_levine.wav"
DIR = "/Volumes/RS1/CLIPS/20170711-1_S020_T.wav"
DIR = "/Volumes/RS1/CLIPS/20170709-1_S01_T.wav"
def get_volumes(filename, threshold=None, fraction=100):
	fraction, ls, length = int(fraction), [], None
	with contextlib.closing(wave.open(filename, 'r')) as w:
		framerate = w.getframerate()
		length = w.getnframes() / float(framerate)
		fr = framerate / fraction
		l = w.readframes(fr)
		while len(l) > 0:
			ls.append(l)
			l = w.readframes(fr)
	volumes = map(lambda l: audioop.rms(l, 2), ls)
	return filter(lambda l: l > 0, volumes), threshold, fraction, length

def get_silence_times(volumes, threshold=450, fraction=100.0, length=None):
	on, start, silences, n_counter = False, None, [], 0
	threshold, fraction = int(threshold), float(fraction)
	for i, n in enumerate(volumes):
		i = float(i)
		if n < threshold and not on and start is None:
			on = True
			start = i / fraction
		elif on and start is not None and n > threshold:
			#n_counter += 1
			#if n_counter >= 5:
			silences.append([start, i / fraction])
			on, start, n_counter = False, None, 0
		#elif on and start is not None and n < threshold:
			#n_counter = 0
	return silences, length

def combine_silences(silences, noise_tolerance=0.15):
	import pdb
	def get_all_indices(haystack, needle, cmp=lambda x, y: x == y):
		return [i for i, x in enumerate(haystack) if cmp(x, needle)]

	def find_repeats(numbers):
		return set([n for n in numbers if len(get_all_indices(numbers, n)) > 1])

	def pull_out_starts(temp_silences):
		return map(lambda s: s[0], temp_silences)

	def pull_out_ends(temp_silences):
		return map(lambda s: s[1], temp_silences)

	def find_occurrence_index(temp_silences, needle, index=0):
		indices = get_all_indices(temp_silences, needle, lambda x, y: x[0] == y)
		try: return indices[index]
		except ValueError: return None

	def is_start_in_array(array, start):
		return len(filter(lambda x: x[0] == start, array)) > 0

	def combine_multiples(temp_silences):
		combined = []
		starts, ends = pull_out_starts(temp_silences), pull_out_ends(temp_silences)
		repeated_starts = find_repeats(starts)
		for repeated_start in repeated_starts:
			first_index = find_occurrence_index(temp_silences, repeated_start, 0)
			last_index = find_occurrence_index(temp_silences, repeated_start, -1)
			combined.append([temp_silences[first_index][0], temp_silences[last_index][1]])
		for silence in temp_silences:
			#import pdb; pdb.set_trace()
			if not is_start_in_array(combined, silence[0]):
				combined.append(silence)
		return combined
	
	temp_silences, combined_silences, previous_start, previous_end, length = [], [], None, None, len(silences)
	skipped_end = None
	for i, silence in enumerate(silences):
		current_start, current_end = silence
		if round(current_end - current_start, 2) <= .05:
			continue
		if previous_end is None:
			previous_end = current_end
			temp_silences.append([current_start, current_end])
		elif round(current_start - previous_end, 2) <= noise_tolerance:
			temp_silences.append([previous_start, current_end])
		else:
			temp_silences.append([current_start, current_end])

		if len(temp_silences) > 0:
			previous_start, previous_end = temp_silences[-1]
		else:
			previous_start, previous_end = current_start, current_end
	return sorted(combine_multiples(temp_silences), key=lambda e: e[0])


def convert_silence_times_to_volume_values(silences, volumes, fraction=100.0):
	volume_indices = map(lambda s: [ s[0] * fraction, s[1] * fraction ], silences)
	volume_values = []
	for v in volume_indices:
		temp = volumes[int(v[0]):int(v[1])]
		volume_values.append(temp)
	return volume_values


def determine_silence_threshold(volumes):
	max_val, min_val = max(volumes), min(volumes)
	diff = max_val - min_val
	threshold = (diff * .25) + min_val
	return threshold

if __name__ == "__main__":
	while True:
		sys.stdout.flush()
		given = raw_input().strip().split(' ')
		if len(given) > 3 or len(given) <= 0:
			continue
		silence_args = list(get_volumes(*given))
		volumes = silence_args[0]
		if silence_args[1] is None:
			silence_args[1] = determine_silence_threshold(silence_args[0])
			threshold = silence_args[1]
		silences, length = get_silence_times(*silence_args)
		silences = combine_silences(silences)
		silences = filter(lambda x: x[1] - x[0] > 0.25, silences)
		silence_volumes = convert_silence_times_to_volume_values(silences, volumes)
		# for i, v in enumerate(silence_volumes):
		# 	print 'std:', numpy.std(v), 'thresh:', threshold, 'max:', max(v), 'min:', min(v), 'mean:', numpy.mean(v), 'max-min:', max(v) - min(v), 'silence:', silences[i]
		filename = given[0].split('/')[-1]
		output = {
			'filename': filename.replace('Leveled-_', '').split('.')[0],
			'silences': silences,
			'fileLength': round(length, 2)
			#'silenceLengths': map(lambda s: [round((s[1] - s[0]) * 100, 2), s], silences)
		}
		sys.stdout.write(json.dumps(output) + "\n")



	# for a, b, c in os.walk(DIR):
	# 	for f in c:
	# 		if '.wav' not in f:
	# 			continue
	# 		ls, audio = [], []
	# 		w = wave.open(DIR + f, 'r')
	# 		fr = w.getframerate() / 4	
	# 		l = w.readframes(fr)
	# 		while len(l) > 0:
	# 			ls.append(l)
	# 			l = w.readframes(fr)
	# 		audio = map(lambda l: audioop.rms(l, 2), ls)
	# 		max_val = max(audio)
	# 		min_val = min(audio)
	# 		average = sum(audio) / len(audio)
	# 		# if 'Leveled' in f:
	# 		print len(ls), f, min_val, audio.index(min_val), max_val, audio.index(max_val), average
	# 		on = False
	# 		silences = []
	# 		start = None
	# 		for i, n in enumerate(audio):
	# 			if n < 600 and not on and not start:
	# 				on = True
	# 				start = i
	# 			elif on and start and n > 600:
	# 				silences.append((start, i))
	# 				on = False
	# 				start = None

	# 		silences = map(lambda l: (l[0] * 0.25, l[1] * 0.25), silences)
