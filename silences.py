#! /usr/bin/python 

import audioop, wave, os, sys, json, contextlib
#DIR = '/home/pedro/Dropbox/Exquisite_Corpse/short_samples/20160522_109_jody_azzouni_1.wav'
#DIR = '/home/pedro/Dropbox/Exquisite_Corpse/Sample audio 060217/'
DIR = "/Users/readingspeaks/Dropbox/Exquisite_Corpse/short_samples/20160521_096_daniel_browne.wav"
DIR = "/Users/readingspeaks/Dropbox/Exquisite_Corpse/short_samples/CONF-1_S003_S003_T002_1.wav"
DIR = "/Users/readingspeaks/Dropbox/Exquisite_Corpse/short_samples/20160522_122_michael_levine.wav"
DIR = "/Users/pedrovmoura/Dropbox/Exquisite_Corpse/short_samples/20160522_122_michael_levine.wav"

def get_volumes(filename, threshold=None, fraction=4):
	fraction, ls, length = int(fraction), [], None
	with contextlib.closing(wave.open(filename, 'r')) as w:
		framerate = w.getframerate()
		length = w.getnframes() / float(framerate)
		fr = framerate / fraction
		l = w.readframes(fr)
		while len(l) > 0:
			ls.append(l)
			l = w.readframes(fr)
	return map(lambda l: audioop.rms(l, 2), ls), threshold, fraction, length

def get_silence_times(volumes, threshold=450, fraction=4.0, length=None):
	on, start, silences = False, None, []
	threshold, fraction = int(threshold), float(fraction)
	for i, n in enumerate(volumes):
		i = float(i)
		if n < threshold and not on and start is None:
			on = True
			start = i / fraction
		elif on and start is not None and n > threshold:
			silences.append([start, i / fraction])
			on, start = False, None
	return silences, length

def determine_silence_threshold(volumes):
	max_val, min_val = max(volumes), min(volumes)
	diff = max_val - min_val
	threshold = (diff * .1) + min_val
	return threshold

if __name__ == "__main__":
	while True:
		sys.stdout.flush()
		given = raw_input().strip().split(' ')
		if len(given) > 3 or len(given) <= 0:
			print "Need at most 3 arguments"
			continue
		silence_args = list(get_volumes(*given))
		if silence_args[1] is None:
			silence_args[1] = determine_silence_threshold(silence_args[0])
		silences, length = get_silence_times(*silence_args)
		filename = given[0].split('/')[-1]
		output = {
			'filename': filename.replace('Leveled-_', '').split('.')[0],
			'silences': silences,
			'fileLength': length
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
