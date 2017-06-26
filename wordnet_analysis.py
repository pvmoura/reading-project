import nltk, sys
from nltk.tag import pos_tag

def check_if_complete_thought(phrase):
	tokenized = nltk.word_tokenize(phrase)
	pos = pos_tag(tokenized)
	print pos
	n_indices, v_indices = [], []
	for i, tagged in enumerate(pos):
		if tagged[1]:
			tag = tagged[1]
			if tag[0] == 'N' or (tag[0] == 'P' and tag != 'PDT') or tag[0] == 'W':
				n_indices.append(i)
			elif tag[0] == 'V':
				v_indices.append(i)
	return n_indices and v_indices and n_indices[0] < v_indices[0]

def get_synonyms(word, wn=nltk.wordnet.wordnet):
	syns = [ t.name() for w in wn.synsets(word) for t in w.lemmas() ]
	return ' '.join(filter(lambda s: s != word, syns))


if __name__ == "__main__":
	wn = nltk.wordnet.wordnet
	wn.synsets('hello')
	sys.stdout.flush()
	sys.stdout.write('ready\n')
	while True:
		sys.stdout.flush()
		words = raw_input().strip()
		words = words.split(" ")
		command = words.pop(0)
		if command == "ct":
			complete = check_if_complete_thought(' '.join(words))
			sys.stdout.write('yes' if complete else 'no')
			sys.stdout.write('\n')
		elif command == "syn":
			for word in words:
				synonyms = get_synonyms(word, wn)
				sys.stdout.write(synonyms + "\n")
				sys.stdout.flush()



