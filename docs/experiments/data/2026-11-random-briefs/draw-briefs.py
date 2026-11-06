# Draws random brief assignments. Usage: python3 draw-briefs.py <seed> <n>
import random, sys, json
seed = int(sys.argv[1]); n = int(sys.argv[2]); rnd = random.Random(seed)
GENRES = ["product launch teaser", "data story", "explainer", "title sequence", "social media ad", "event promo",
          "app feature walkthrough", "brand manifesto", "year-in-review", "science explainer", "sports stat recap",
          "kinetic poem (no voice)", "logo sting with tagline", "infographic", "onboarding tutorial"]
SUBJECTS = ["a solar-powered bicycle", "deep-sea creatures", "a coffee subscription", "the history of the zipper",
            "a city marathon", "a password manager", "coral reefs", "a jazz festival", "a budgeting app", "volcanoes",
            "a bakery opening", "electric ferries", "the water cycle", "a chess tournament", "an indie video game",
            "urban beekeeping", "a language-learning app", "a public library", "Mars rovers", "a recycling program"]
TECHNIQUES = ["a camera moving through one continuous world", "kinetic typography", "shape morphing",
              "path animation / lines that draw themselves", "3D depth and parallax", "an animated chart",
              "counters and numbers", "a UI mockup with cursor interactions",
              "character or object animation with squash and stretch", "particles or bursts",
              "masked reveals and wipes", "match cuts / shared-element transitions", "a living ambient background",
              "a map or route animation", "a hand-drawn / sketch look"]
FONTS = ["Inter", "Space Grotesk", "Playfair Display", "Bebas Neue", "JetBrains Mono", "Caveat", "Nunito"]
out = []
for i in range(n):
    vertical = rnd.random() < 0.3
    out.append({"id": chr(ord('a') + i), "genre": rnd.choice(GENRES), "subject": rnd.choice(SUBJECTS),
                "techniques": rnd.sample(TECHNIQUES, 3), "format": "1080x1920 (vertical)" if vertical else "1920x1080",
                "seconds": rnd.randint(15, 25), "fonts": FONTS})
print(json.dumps(out, indent=1))
