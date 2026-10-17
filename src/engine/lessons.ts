/**
 * Daily lessons: one timeless idea per day, framed for a fast, always-on life.
 * Quotes are from public-domain authors; the lesson and practice text is original.
 */

export interface Lesson {
  id: string;
  theme: string;
  emoji: string;
  hues: [string, string]; // gradient for the card
  quote: string;
  author: string;
  lesson: string;
  practice: string; // one small action for today
}

export const LESSONS: Lesson[] = [
  {
    id: "delayed-gratification", theme: "Delayed gratification", emoji: "⏳", hues: ["#22d3ee", "#a78bfa"],
    quote: "No great thing is created suddenly.", author: "Epictetus",
    lesson: "Every feed, app and checkout button is engineered to collapse the gap between wanting and having. The people who win long games learn to live comfortably inside that gap — the skill isn't saying no forever, it's saying \"not yet\" and meaning it.",
    practice: "Pick one thing you want to buy or check right now. Wait 24 hours before you do it.",
  },
  {
    id: "patience", theme: "Patience", emoji: "🌱", hues: ["#34d399", "#22d3ee"],
    quote: "Adopt the pace of nature: her secret is patience.", author: "Ralph Waldo Emerson",
    lesson: "Things that compound — skills, savings, relationships, health — look like nothing is happening for a long time, and then everything happens at once. Impatience usually isn't a lack of progress; it's checking the soil every hour to see if the seed has sprouted.",
    practice: "Choose one long-term goal and do its smallest next step — without checking how far you've come.",
  },
  {
    id: "busy-vs-productive", theme: "Busy ≠ productive", emoji: "🐜", hues: ["#fbbf24", "#f472b6"],
    quote: "It is not enough to be industrious; so are the ants. What are you industrious about?", author: "Henry David Thoreau",
    lesson: "A full calendar and a full inbox can feel like progress, but motion isn't direction. The most important work rarely shouts; it waits quietly while urgent-but-trivial things take the day.",
    practice: "Before you open messages, write down the one task that would make today a success. Do it first.",
  },
  {
    id: "time-is-life", theme: "Time is life", emoji: "⌛", hues: ["#a78bfa", "#f472b6"],
    quote: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca",
    lesson: "We guard our money with passwords and budgets, then give our hours away to whoever asks loudest. Minutes spent scrolling aren't free — they're paid for with the only currency you can't earn back.",
    practice: "Check your phone's screen-time for yesterday. Decide on one app to cap today.",
  },
  {
    id: "postponing", theme: "Stop postponing", emoji: "🚪", hues: ["#f87171", "#fbbf24"],
    quote: "While we are postponing, life speeds by.", author: "Seneca",
    lesson: "\"Someday\" is the most expensive word in planning. The perfect moment to start the course, the call, the savings plan, the workout rarely arrives — the imperfect one is already here.",
    practice: "Find one item that's been on your list for over a month. Spend 10 minutes on it today.",
  },
  {
    id: "imagination", theme: "Worry less", emoji: "🌫️", hues: ["#60a5fa", "#a78bfa"],
    quote: "We suffer more often in imagination than in reality.", author: "Seneca",
    lesson: "An endless stream of news and notifications hands our minds a thousand disasters a day, most of which never arrive. Anxiety rehearses problems you might never have; preparation handles the few you will.",
    practice: "Write down one worry. Next to it, write the single concrete step you can take — or cross it out.",
  },
  {
    id: "perception", theme: "It's your view of it", emoji: "🔭", hues: ["#22d3ee", "#34d399"],
    quote: "Men are disturbed not by things, but by the views which they take of things.", author: "Epictetus",
    lesson: "Traffic, a rude email, a red day in the market — the event is fixed, the story you tell about it isn't. Between what happens and how you react sits a small gap. Widening it is a lifelong skill.",
    practice: "The next time something irritates you today, pause for one breath and name the story you're telling yourself.",
  },
  {
    id: "single-step", theme: "Start small", emoji: "👣", hues: ["#34d399", "#fbbf24"],
    quote: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu",
    lesson: "Big goals stall because they're stored as big goals. Nobody can \"get fit\" or \"learn Rust\" today — but anyone can put on running shoes or read one page. Make the first step so small it feels silly to skip.",
    practice: "Break a goal you've been avoiding into a step that takes under two minutes. Do it now.",
  },
  {
    id: "know-yourself", theme: "Know yourself", emoji: "🪞", hues: ["#a78bfa", "#60a5fa"],
    quote: "He who knows others is wise; he who knows himself is enlightened.", author: "Lao Tzu",
    lesson: "We track steps, spending and screen-time, yet rarely track what actually drains or fuels us. Self-knowledge is data too — and it's the dataset every other decision depends on.",
    practice: "Tonight, note the one moment today that gave you energy and the one that drained it.",
  },
  {
    id: "sit-quietly", theme: "Sit with boredom", emoji: "🪑", hues: ["#60a5fa", "#22d3ee"],
    quote: "All of humanity's problems stem from man's inability to sit quietly in a room alone.", author: "Blaise Pascal",
    lesson: "Boredom used to be the space where ideas showed up. Now we fill every queue, lift and red light with a screen. Creativity and clarity need empty minutes — protect a few.",
    practice: "Spend 5 minutes today doing nothing: no phone, no music, no podcast. Just notice what comes up.",
  },
  {
    id: "make-it-shorter", theme: "Simplicity takes time", emoji: "✂️", hues: ["#fbbf24", "#22d3ee"],
    quote: "I have made this longer than usual because I have not had time to make it shorter.", author: "Blaise Pascal",
    lesson: "Clarity is work. The short email, the simple plan, the clean design — they look effortless because someone spent the time to cut. Rushing produces length; patience produces simplicity.",
    practice: "Before sending your next long message, cut it in half.",
  },
  {
    id: "simplify", theme: "Simplify", emoji: "🍃", hues: ["#34d399", "#60a5fa"],
    quote: "Our life is frittered away by detail. Simplify, simplify.", author: "Henry David Thoreau",
    lesson: "Every subscription, app, open tab and half-finished project asks for a sliver of attention. Individually tiny, together they're a constant low hum. Removing things is often the fastest upgrade available.",
    practice: "Cancel one subscription, delete one app, or close every tab you aren't using.",
  },
  {
    id: "cost-of-things", theme: "The real price", emoji: "🏷️", hues: ["#f472b6", "#fbbf24"],
    quote: "The cost of a thing is the amount of what I will call life which is required to be exchanged for it.", author: "Henry David Thoreau",
    lesson: "A price tag in rupees hides the true price: hours of your work. A Rs 20,000 gadget isn't twenty thousand — it's however many days you traded to earn it. Seen that way, some purchases get cheaper and many get far more expensive.",
    practice: "Convert your next non-essential purchase into hours of work before you decide.",
  },
  {
    id: "small-leaks", theme: "Small leaks", emoji: "💧", hues: ["#60a5fa", "#34d399"],
    quote: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin",
    lesson: "Big purchases get scrutiny; small ones slip through — the daily delivery fee, the coffee, the in-app top-up. They're invisible one at a time and enormous over a year.",
    practice: "Open your Spending page and find your most frequent small expense. Multiply it by 365.",
  },
  {
    id: "lost-time", theme: "Time can't be refunded", emoji: "🕰️", hues: ["#a78bfa", "#fbbf24"],
    quote: "Lost time is never found again.", author: "Benjamin Franklin",
    lesson: "Money spent badly can be earned back. A wasted evening can't. That isn't a reason for guilt — it's a reason to spend time on purpose, including rest that you actually choose.",
    practice: "Decide tonight how you'll spend the first hour after work tomorrow. Write it down.",
  },
  {
    id: "well-done", theme: "Do, don't announce", emoji: "🛠️", hues: ["#22d3ee", "#fbbf24"],
    quote: "Well done is better than well said.", author: "Benjamin Franklin",
    lesson: "Sharing goals online can deliver the satisfaction of achievement before any achieving happens. Quiet progress compounds; loud plans often evaporate.",
    practice: "Make progress on one goal today without telling anyone about it.",
  },
  {
    id: "be-one", theme: "Act, don't debate", emoji: "⚡", hues: ["#fbbf24", "#f87171"],
    quote: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius",
    lesson: "We consume endless content about productivity, health and money — the reading becomes a substitute for doing. You already know enough to take the next step.",
    practice: "Replace one video or article today with ten minutes of doing the thing it's about.",
  },
  {
    id: "quality-of-thoughts", theme: "Mind your inputs", emoji: "🧠", hues: ["#a78bfa", "#22d3ee"],
    quote: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius",
    lesson: "Your thoughts are built from what you feed them. A day of outrage headlines and comparison scrolling produces a different mind than a day of books, walks and good conversations.",
    practice: "Mute or unfollow one account that reliably leaves you feeling worse.",
  },
  {
    id: "not-right", theme: "Integrity", emoji: "🧭", hues: ["#34d399", "#a78bfa"],
    quote: "If it is not right, do not do it; if it is not true, do not say it.", author: "Marcus Aurelius",
    lesson: "Speed tempts shortcuts — the exaggerated claim, the corner cut to meet a deadline. Integrity is cheap to keep and very expensive to rebuild.",
    practice: "Today, choose the honest answer in one situation where a convenient half-truth would be easier.",
  },
  {
    id: "little-needed", theme: "Enough", emoji: "🫖", hues: ["#fbbf24", "#34d399"],
    quote: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", author: "Marcus Aurelius",
    lesson: "Lifestyle creep moves the finish line every time you get close. Deciding what \"enough\" looks like turns money from a treadmill into a tool.",
    practice: "Write down three things you already have that you'd hate to lose.",
  },
  {
    id: "craves-more", theme: "Wanting less", emoji: "🪙", hues: ["#22d3ee", "#34d399"],
    quote: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca",
    lesson: "You can get richer two ways: earn more, or need less. The second is faster, available today, and isn't taxed.",
    practice: "Before your next purchase, ask: will I still care about this in a month?",
  },
  {
    id: "each-day", theme: "One day at a time", emoji: "🌅", hues: ["#f472b6", "#a78bfa"],
    quote: "Begin at once to live, and count each separate day as a separate life.", author: "Seneca",
    lesson: "Thinking in years is overwhelming; thinking in days is manageable. Win today — sleep, move, focus, connect — and the years take care of themselves.",
    practice: "Tonight, give today a score out of 10 and note one thing that would make tomorrow an 8.",
  },
  {
    id: "what-to-overlook", theme: "What to ignore", emoji: "🙈", hues: ["#60a5fa", "#f472b6"],
    quote: "The art of being wise is the art of knowing what to overlook.", author: "William James",
    lesson: "Information is unlimited; attention isn't. Every market tick, group chat and trending topic is optional. Wisdom today is mostly a filter.",
    practice: "Turn off notifications for one app that interrupts you but rarely matters.",
  },
  {
    id: "patience-and-time", theme: "Time & patience", emoji: "♟️", hues: ["#a78bfa", "#34d399"],
    quote: "The two most powerful warriors are patience and time.", author: "Leo Tolstoy",
    lesson: "In markets, careers and relationships, the person who can wait usually beats the person who can't. Patience isn't passive — it's choosing not to interrupt something that's working.",
    practice: "Look at your portfolio once today at most. Don't trade on a feeling.",
  },
  {
    id: "examined-life", theme: "Reflect", emoji: "📓", hues: ["#22d3ee", "#a78bfa"],
    quote: "The unexamined life is not worth living.", author: "Socrates",
    lesson: "We review code, spending and fitness data — but rarely our own weeks. A few minutes of honest reflection turns experience into learning instead of repetition.",
    practice: "Write three lines: what went well this week, what didn't, what you'll change.",
  },
  {
    id: "first-say", theme: "Decide who you are", emoji: "🎯", hues: ["#f472b6", "#22d3ee"],
    quote: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus",
    lesson: "Goals describe outcomes; identity describes behaviour. \"I'm someone who saves\" or \"I'm a runner\" makes the daily choice obvious long before the result shows up.",
    practice: "Finish the sentence \"I am someone who…\" for one goal, and act like it once today.",
  },
  {
    id: "know-ignorance", theme: "Know what you don't know", emoji: "❓", hues: ["#fbbf24", "#a78bfa"],
    quote: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius",
    lesson: "Confidence is cheap online; everyone sounds certain. The strongest learners and investors are comfortable saying \"I don't know yet\" — and then going to find out.",
    practice: "Say \"I don't know\" once today when you're tempted to bluff, then look it up.",
  },
  {
    id: "compounding", theme: "Compounding", emoji: "📈", hues: ["#34d399", "#22d3ee"],
    quote: "No great thing is created suddenly, any more than a bunch of grapes or a fig.", author: "Epictetus",
    lesson: "1% better each day is roughly 37× better in a year — and 1% worse leaves almost nothing. Compounding works on money, skills, habits and debts alike; the direction matters more than the speed.",
    practice: "Identify one 1% improvement you can repeat every day this week.",
  },
  {
    id: "deep-work", theme: "Deep focus", emoji: "🎧", hues: ["#60a5fa", "#a78bfa"],
    quote: "Hold every hour in your grasp. Lay hold of to-day’s task, and you will not need to depend so much upon to-morrow’s.", author: "Seneca",
    lesson: "Switching tasks every few minutes feels efficient but costs a re-start each time. One undisturbed hour often beats a fragmented day.",
    practice: "Block 45 minutes today with your phone in another room. Work on one thing only.",
  },
  {
    id: "rest", theme: "Rest is productive", emoji: "🌙", hues: ["#a78bfa", "#60a5fa"],
    quote: "Begin at once to live.", author: "Seneca",
    lesson: "Hustle culture treats sleep as a cost to cut. In reality, rest is when the body repairs and the brain files away what it learned. A tired mind makes expensive decisions.",
    practice: "Set a phone-down time tonight, 30 minutes before you want to sleep.",
  },
  {
    id: "comparison", theme: "Stop comparing", emoji: "🪟", hues: ["#f472b6", "#34d399"],
    quote: "Men are disturbed not by things, but by the views which they take of things.", author: "Epictetus",
    lesson: "Social feeds show everyone's highlight reel against your behind-the-scenes. The only fair comparison is you against who you were last year.",
    practice: "Write one way you're better off than you were a year ago.",
  },
  {
    id: "two-minute", theme: "The two-minute rule", emoji: "⏱️", hues: ["#22d3ee", "#f472b6"],
    quote: "Well done is better than well said.", author: "Benjamin Franklin",
    lesson: "Small tasks left undone pile up into a background weight. If something takes under two minutes, the fastest way to stop thinking about it is to do it.",
    practice: "Clear three tasks from your list that each take under two minutes.",
  },
  {
    id: "money-is-freedom", theme: "Money buys options", emoji: "🕊️", hues: ["#34d399", "#fbbf24"],
    quote: "It is not the man who has too little, but the man who craves more, that is poor.", author: "Seneca",
    lesson: "The best thing money buys isn't stuff — it's the ability to say no: to a bad job, a bad deal, a bad week. An emergency fund is freedom you can measure.",
    practice: "Move a small amount — even Rs 1,000 — into savings today, on purpose.",
  },
  {
    id: "attention-is-scarce", theme: "Attention is the asset", emoji: "🎟️", hues: ["#fbbf24", "#60a5fa"],
    quote: "The art of being wise is the art of knowing what to overlook.", author: "William James",
    lesson: "Apps compete for your attention because it's valuable — it's what they sell. Treat it like money: budget it, invest it, and notice who's spending it for you.",
    practice: "Leave your phone face-down and out of reach during your next meal.",
  },
  {
    id: "consistency", theme: "Consistency over intensity", emoji: "🔁", hues: ["#22d3ee", "#34d399"],
    quote: "No great thing is created suddenly.", author: "Epictetus",
    lesson: "A huge burst of motivation followed by a crash loses to a small habit you never break. Showing up on the bad days is what makes the good days count.",
    practice: "Do a minimum version of a habit today, even if it's only five minutes.",
  },
  {
    id: "ship-imperfect", theme: "Done beats perfect", emoji: "🚀", hues: ["#f87171", "#a78bfa"],
    quote: "While we are postponing, life speeds by.", author: "Seneca",
    lesson: "Perfectionism often wears the costume of high standards while really being fear. Shipping something imperfect gives you feedback; polishing in private gives you nothing.",
    practice: "Send, publish or submit one thing today that's \"good enough\".",
  },
  {
    id: "listen", theme: "Listen more", emoji: "👂", hues: ["#60a5fa", "#34d399"],
    quote: "He who knows others is wise; he who knows himself is enlightened.", author: "Lao Tzu",
    lesson: "Half-listening while checking a phone tells people where they rank. Full attention is rare enough now to feel like a gift.",
    practice: "In one conversation today, put your phone away and ask one follow-up question.",
  },
  {
    id: "gratitude", theme: "Notice what's good", emoji: "🙏", hues: ["#fbbf24", "#f472b6"],
    quote: "Very little is needed to make a happy life.", author: "Marcus Aurelius",
    lesson: "The brain is wired to spot problems, and feeds exploit that. Deliberately noticing what's going right isn't naive — it rebalances a mind tuned for threats.",
    practice: "Message someone today to thank them for something specific.",
  },
  {
    id: "long-game", theme: "Play the long game", emoji: "🏔️", hues: ["#a78bfa", "#22d3ee"],
    quote: "The two most powerful warriors are patience and time.", author: "Leo Tolstoy",
    lesson: "Most people overestimate what they can do in a month and underestimate what they can do in five years. Short-term noise fades; long-term direction compounds.",
    practice: "Open your Goals page and make sure each active goal has a next step scheduled.",
  },
  {
    id: "health-first", theme: "Health is wealth", emoji: "💪", hues: ["#34d399", "#f472b6"],
    quote: "The happiness of your life depends upon the quality of your thoughts.", author: "Marcus Aurelius",
    lesson: "Sitting all day, eating fast and sleeping late are the default settings of modern life. Every other goal rides on a body that works — maintenance isn't optional.",
    practice: "Take a 15-minute walk today without your headphones.",
  },
];

const D = 86400000;

/** Days since 1970-01-01 in local time (so the lesson changes at local midnight). */
export function localDayNumber(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / D);
}

/** Deterministic shuffle (mulberry32) so the order looks random but is stable for everyone. */
function shuffled<T>(arr: T[], seed: number) {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Lesson for a given day. Each full cycle through the library uses a fresh
 * shuffle, so nothing repeats until every lesson has been shown.
 */
export function lessonForDay(day: number, list: Lesson[] = LESSONS) {
  const n = list.length;
  const cycle = Math.floor(day / n), idx = ((day % n) + n) % n;
  return shuffled(list, 0x5eed + cycle)[idx];
}

export const lessonForDate = (d = new Date()) => lessonForDay(localDayNumber(d));

/** Milliseconds until the next local midnight (when the lesson changes). */
export function msUntilNextLesson(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return +next - +now;
}
