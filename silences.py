import audioop, wave, os
DIR = '/home/pedro/Dropbox/Exquisite_Corpse/short_samples/'
#DIR = '/home/pedro/Dropbox/Exquisite_Corpse/Sample audio 060217/'
for a, b, c in os.walk(DIR):
	for f in c:
		if '.wav' not in f:
			continue
		ls, audio = [], []
		w = wave.open(DIR + f, 'r')
		fr = w.getframerate() / 4	
		l = w.readframes(fr)
		while len(l) > 0:
			ls.append(l)
			l = w.readframes(fr)
		audio = map(lambda l: audioop.rms(l, 2), ls)
		max_val = max(audio)
		min_val = min(audio)
		average = sum(audio) / len(audio)
		print len(ls), f, min_val, audio.index(min_val), max_val, audio.index(max_val), average
		on = False
		silences = []
		start = None
		for i, n in enumerate(audio):
			if n < 600 and not on and not start:
				on = True
				start = i
			elif on and start and n > 600:
				silences.append((start, i))
				on = False
				start = None

		silences = map(lambda l: (l[0] * 0.25, l[1] * 0.25), silences)
		print audio, silences
		break
