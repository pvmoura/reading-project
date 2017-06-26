import audioop, wave, os

for a, b, c in os.walk('./sounds'):
	for f in c:
		if '.wav' not in f:
			print f
			continue
		ls, audio = [], []
		w = wave.open('./sounds/' + f, 'r')
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
		print map(lambda l: l < average, audio)
