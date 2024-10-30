---
draft: false
params:
  author: Mike Votaw
title: Step Annotations and Stuff
---

```stepchart {quantization=8}

1000
0102
00M3
0001

```

# what is this 

this write up is just as much for me as it is anyone else who's interested in implementing something like this


# okay cool but why

https://itgwiki.dominick.cc/en/meta/what-is-itg

# All the difficulties in predicting this

In general, predicting how a player will move to a step chart isn't that difficult. 

One core assumption being made is that the player will want to be facing forward. 

And generally, arrows are pressed with alternating feet. 

So for any given arrow, there's usually only two options: did they hit this with their left foot, or right foot? And which is the "least awkward" to use?

Jumps also aren't terribly complicated. A player is probably going to make the smallest movement that they can to achieve the jump.

Hold/Roll arrows, mines, complicate things, but again it's not all that weird.

It starts to get complicated when dealing with what the community refers to as "tech", and brackets in particular.

https://itgwiki.dominick.cc/en/playstyles/technical-and-fantastic-attack


Brackets suddenly open up the possibility of hitting two different notes at the same time with one foot. Now we have to decide, is this a regular jump, or is it a bracket, and if so, which foot is used to bracket it, and what direction is the foot pointing

Footswitches vs Jacks typically rely on in-chart notation of having a mine placed between two notes

Holdswitches break the assumption that a foot holding a note will remain stationary


# describe the algorithm 

terms:
columns (referred to as 'tracks' within most of Stepmania's code)
rows: the set of notes that are being pressed at the same time at a given point in time

StageLayout: contains information about the layout of the dance pad for a given StepsType
 - number of columns for this StepsType
 - position of each arrow
 - which arrows are considered 'up', 'down', or 'side' arrows


A naive approach would be to try to determine the best possible position for each row individually, based on the determined best position of the previous row. But then you're unable to correct mistakes if you find yourself in an awkward position a few rows later.

Instead, I opted to build a graph, with each node representing a possible position at a certain moment in time. 
This actually ended up working out really well. 

The data is, by its very nature, strictly ordered. Nodes for a given row will only point to nodes for the next row. It ends up being a very tidy directed acyclic graph.

https://en.wikipedia.org/wiki/Directed_acyclic_graph

Which means we can build the graph and determine the cheapest path through it in linear time. which is pretty cool.


The basic algorithm looks like:

Create an initial Start Node, that represents some time before the first row of the step chart, with a State gives the player no particular starting position.

For each row in the step chart, do the following:
- Determine all of the physically possible foot placements to satisfy the notes on that row
- For each node of the previous row:
  - iterate through each possible foot placement, doing the following:
    - based on the state of the given previous node, generate a result state
    - calculate the cost of moving from the previous state to this new state
    - create a new node for this result state (or find an existing node already using that state), and add an edge from the previous node to this result node, with the calculated cost

Once the last row has been completed, create an End Node, which represents the moment after the last note of the step chart. Attach all of the nodes from the last row to this final row, with a cost of 0.


How to generate foot placement permutations:

The function permuteColumns is a recursive function to generate any physically possible foot placement for a given row.
Initial input is the given row, a column index of 0, and an array representing the foot placement for each column, all initialized to NONE.
Returns an array of arrays of foot placements.

If the column index is greater than the number of columns, perform some checks to ensure that a valid foot placement has been generated.
If the foot placement is valid, then return the array, otherwise return an empty array.

Otherwise, for the given column index:
- If the row has no note or active hold for this column, return the results of permuteColumns, passing in the same foot placement, and incrementing the column index
- Otherwise, iterate through every foot part that hasn't already been used by another column, and collect the results of calling the function recursively.
  Then return the collected permutations

This can be pretty time-consuming to generate, but fortunately it's easy enough to cache the results and reuse them for later rows.

Checking for valid foot placements include things like making sure we're not trying to bracket something that we should't, or are using the toe of a foot without also using the heel.


How to calculate costs:

Current 14 different costs are calculated (percent of nodes that have a value > 0)

First, the basic costs: DISTANCE, FACING, and DOUBLESTEP.

These three costs alone do a pretty good job of predicting a player's movement, especially on easier, non-technical charts, and *especially* if you don't want to bother with predicting brackets. 

-----

DISTANCE (34%)
Generally speaking, this is fairly simple, we're just calculating the distance that each foot (or part of the foot) moved from the previous state to the result state. 
The shorter the elapsed time between this state and the previous, the higher the cost (the elapsed time tends to be < 1)

cost += (sqrt((i.y - r.y)^2 + (i.x - r.x)^2) * DISTANCE) / elapsedTime

But there a few wrinkles to this.
If the player is bracketing two notes, we want to check if the other part of the foot is now pressing an arrow that the current part of the foot was on in the previous state 
and if so, we don't calculate any cost for that movement. This fixes two issues:
- It treats brackets consistently. Without checking this, a movement like

```stepchart {quantization=8}
0001 R
1000 L
0011 rR
0000
0000
0000
```

Wouldn't incur any movement cost, but a movement like

```stepchart {quantization=8}
0001 R
1000 L
0101 Rr
0000
```
would, simply because the heel is considered to have moved. In practice, these movements are fairly small (and in the second scenario, the player is likely pressing the right arrow more with the ball of their foot than their heel anyway).

- In a situation where the player is moving from one bracket to another, we don't want to double-count the movement unless it makes sense to (and in Dance Single, it's basically impossible to move from bracketing two notes to bracketing two completely different notes)

```stepchart {quantization=8}
0011 rR
1000 L
0101 Rr
0000
```
Since both the left heel and toes are moving, we don't want to double-count this, so we ignore the cost of the heel moving.

And the current algorithm cuts any costs by 80% if the player is bracketing. This is probably an over-fitting for Dance Single, since it would be possible to make a full movement while bracketing in Dance Double, like

```stepchart {quantization=8, stepstype="dance-double"}

0000 1100 rR
0001 0000 L
0000 0011 rR
```
is a pretty big movement, so it would make sense to consider that at full cost

but that's something to explore at a later date

-----

FACING (18%)

The goal of this is to make movements that turn the player away from the screen heavier costs.
So we take the resulting position, and figure out how far from the screen the player is turned.

dx = right.x - left.x
dy = right.y - left.y

dist = sqrt(dx^2 + dy^2)

dx/dist = a cosine value. 

This gives us the degree of turning, just without an indication of which direction.

1 == facing directly at the screen (L..R)
0 == 90 degrees (.LR. or .RL.)
-1 == facing directly away (R..L)

Any value that's >= 0 will have a cost of 0.

And we want this to scale exponentially as the value approaches -1, so that something like .L.R is less costly than R..L


-----

DOUBLESTEP (17%)

In this context, a doublestep is any time the player hits a note with one foot, and then uses that same foot to hit a different note on the next row.

We want to minimize "unforced" doublesteps, while allowing "forced" doublesteps.

An unforced doublestep is something like:

```stepchart {quantization=8}
1000 L
0100 R
0001 R
```

While a forced doublestep can occur due to the other foot holding a hold arrow

```stepchart {quantization=8}
2000 L
0100 R
0001 R
3000 L
```

and 

2000
0R00
300R
0000

are obviously forced, but we also consider some cases where the hold arrow ends before
the next note, but after the previous to be "forced"

2000
0R00
3000
000R

could be considered "forced", assuming that the player is holding the note for its entire duration.

But something like

2000
0R00
3000
0000
0000
000R

Shouldn't be considered forced, since there's plenty of time to move your left foot in this case.

And obviously if the hold ends on the same row as the previous step, then it's an unforced doublestep:

2000
3R00
000R
0000

And then of course there are things that just aren't doublesteps at all.

If a jump is involed, we don't want to consider it a doublestep:

L000
0R00
00LR
0000

L000
LR00
000R
0000

And hitting the same note twice with the same foot is a jack:

L000
0R00
0R00
0000


The actual implementation of this is pretty messy right now, mostly due to how hold notes are tracked, but it basically boils down to:

- Is there a jump in the result state? Not a double step
- Was there a jump in the previous state? Not a double step
- Did the player hit a note with one foot in the previous state, and then use that foot to hit a *different note* this state? This is a double step.
- If so, are they actively holding, or just recently released, a hold note with their other foot? Then this is a forced double step, and incurs no penalty.
- Otherwise, this is an unforced doublestep, and should incur a penalty.

It's fairly common for these costs to be scaled by the time elapsed between rows, with the thinking that quicker movements are harder to perform. But in the case of doublestepping, this is something that is just generally avoided by players, regardless of the speed, so this has a static cost.


-----
-----


As mentioned above, these three costs cover probably 90% of all of the steps in most step charts. 

But the whole reason why this is being done is to predict that remaining 10% accurately, so that we can then calculate tech counts accurately.

From here, we begin moving into increasingly tech-specific costs that are designed to nudge the prediction towards or away from brackets, jacks, footswitches.

First, let's take a look at bracket-related costs.

Deciding when it makes sense to bracket something vs treating it as a regular jump took a long time to get right. The line between "could be bracketed" and "should/supposed to be bracketed" is a little subjective. My goal was to emphasize bracketing when it made sense, but not over-emphasize it.
The original algorithm way over-emphasized bracketing by having jumps incur a specific cost that almost always made them more expensive than bracketing, so that got removed.

TWISTED FOOT and SLOW BRACKET ended up being the pieces that I needed 

-----


TWISTED FOOT (2%)

This is intended to prevent the algorithm from selecting "convenient" (in the sense that the move could be considered less costly), but damn near impossible foot positions.

Without this cost, it's common for the algorithm to select

000R
L000
00rR
L000
000R

over

000R
L000
00Rr
L000
000R

Because the cost of the first ends up being lower due to technically moving your right foot less.

This one was kind of difficult to figure out. I'd considered trying to eliminate these positions from being returned by permuteColumns, but it's difficult to know if a player's foot is actually twisted backwards for a given row without additional context. And I didn't want to risk eliminating a potentially valid foot placement for some wild tech chart that wasn't taken into account.

Because we need to catch things like

000R
0L00
00Rr
0L00

while still allowing something like

000R
0L00
rR00
0L00

since that would probably be more comfortable to perform than

000R
0L00
Rr00
0L00

glitchbear from the ITC discord helped me get something figured out.

The basic idea is:

- First, check if either foot is bracketing something right now. Because if not, then there's no need to perform the rest of these calculations.

- Take the "average" position of each foot 
  (ie, if both the left heel and left toe are actively pressing an arrow,  average the position of the two, otherwise just use the left heel)

- If the right foot is farther left than the left foot, then the player is performing some sort of crossover, in which case
  we don't want to penalize anything

- Check if either foot is backwards (that is, are the toes farther away from the front than the heel).
  If so, then this will incur a heavy penalty, currently set at 100000.


-----

SLOW BRACKET (2%)

This one is pretty simple. The more time a player has between notes, the less likely it is that they're "supposed" to bracket a given jump.

After some experimentation, a threshold of 0.15 seconds (1/16th notes at 100bpm, or 1/8th notes at 200bpm) was decided on.

- First, obviously check that the player is bracketing something
- Get the elapsed time between the result state and previous state.
- If it's less than the threshold, then no penalty
- Otherwise, take the difference between the elapsed time and the threshold, and multiply it by SLOWBRACKET. In our case, this is set at 400.

This results in a cost that starts pretty small and slowly grows with the elapsed time.


-----
-----

Now let's look at footswitch/jack specific costs.

Footswitches are commonly notated with the addition of a mine to act as a visual indicator that the player should footswitch on a given set of notes

000R
L000
0R00
00M0
0L00
000R
0000
0000

Without this indication, it can be difficult to determine whether you should footswitch or jack, as performing the wrong maneuver will leave you on the wrong foot for performing the rest of the phrase:

000R
L000
0R00
0R00

vs

000R
L000
0R00
0L00

could both be valid, depending on what follows. For instance, the phrase

0001
1000
0100
0100
0001
0010

would be less awkward with a footswitch, but

0001
1000
0100
0100
1000
0001

would be less awkward with a jack.


There's four separate costs here that help nudge things: FOOTSWITCH, SIDESWITCH, JACK, and MISSED_FOOTSWITCH


-----

FOOTSWITCH (5%)

Perhaps a better name for this would be SLOW_FOOTSWITCH.

In general, the faster a pattern of repeating notes is, the most likely that the player will want to footswitch it. Below a certain speed, some players might actually find footswitches more awkward to perform than a jack.

So the first part of this cost is checking if the elapsed time is above a certain threshold. Anything faster than this threshold will incur no cost for footswitching.

And, as mentioned above, if the repeating notes have a mine placed in between them, then this is likely a notation indicating that this should be footswitched, and so there's no cost.

Otherwise, we want to generate a cost that scales inverse to the speed of the footswitch, so that slower footswitches are penalized more.

To do this, I'm taking ((elapsedTime - threshold) / elapsedTime) * FOOTSWITCH. So as elapsedTime grows, the calculated cost approaches FOOTSWITCH. Another way to look at that would be (1 - (threshold/elapsedTime)) * FOOTSWITCH.


I have the threshold set at 0.2 seconds (1/8th note at 150bpm), and FOOTSWITCH set to 325. This seems to be a good balance.


So the general idea here is:

- Figure out if the player is footswitching
- Check if the footswitch is happening quicker than a given threshold
- Check if the footswitch has been notated
- If not, calculate a scaling factor based on elapsedTime


-----

JACK (0.06%)

As sort of mentioned above, repeating notes are harder to hit with the same foot as their speed increases. 

The goal here is to make the jack more costly than the footswitch, primarily by being more costly than the cost calculated by DISTANCE.

TODO: I need to change the cost calculation I'm using.

I was originally using a scaled cost for this, but in writing this I realized that it was actually doing the opposite of what I intended, which was heavily penalizing jacks that were near the threshold and then scaling towards zero as the elapsedTime got quicker.

For now I think I'm going to use just a constant value


-----

SIDESWITCH (7%)

A specific variation of a footswitch, the sideswitch is considered slightly more difficult to perform than a footswitch on the up or down arrow.

So this is basically just checking if there's a footswitch happening on either the left or right arrow.

-----
-----

From here, we get into more obscure things.


-----

Bracket Tap

This is when the player trys to tap a note with one part of their foot while holding a note with the other.
```stepchart

3000 L
0100 lL
2000 L
0000
```


This cost is necessary to keep the algorithm from always choosing this, since it would otherwise be less costly due to the fact that this wouldn't have any distance movement penalty.

This basically comes down to:
- Is part of one foot holding a note
- Is the other tapping a note

The current cost calculation checks if part of the foot moved in the previous state, and if so, lessens the cost. I'm honestly not sure why.


-----

BRACKETJACK (0.3%)

This is when a player hits a bracket right after stepping on arrow

000R
L000
lL00
0000

Steps like this are usually not intended to be brackets. So this incurs a very small penalty (it's currently set to 20) just to nudge the algorithm away from choosing this.

Current calculation looks like:

- Check that there are no holds
- Check that only the left or right foot has moved
- Check that the previous row wasn't a jump
- Then check that this is in fact a jack, and that both parts of the foot are being used


-----

HOLDSWITCH (4%)

A holdswitch is exactly what it sounds like: the player quickly swaps feet so that the other foot is now holding a note, and the original foot is now tapping a note.

0300 L
0010 LR
1000 LR
0200 R


I can't come up with a good example of this right now. This is something that's well outside of my skill range.

Like the BRACKETTAP cost, this cost is necessary to keep the algorithm from choosing this unnecessarily.

If there are any active holds, check the previous state to see if the same foot is holding the note.
If not, incur a penalty multiplied by the distance that foot had to move to hit the new note.


-----

SPIN (3%)

When I started writing this all up, I wasn't sure if this cost was really even necessary, as it seems like FACING should be handling this, but it seems to basically prevent crossovers from becoming spins.

Basically what you're checking is
 - Is right.x < left.x for this state and the previous state
 - Was right.y < left.y in the previous state, but now right.y > left.y, or the opposite (was right.y > left.y in the previous state, but now right.y < left.y)
 - If so, add a kind of heavy cost to keep the algorithm from picking this (currently set to 1000)


----- 

MISSED_FOOTSWITCH (0.26%)

This is basically meant to further emphasize footswitches that have been notated with a mine should be chosen over jacks, by penalizing jacks that occur with a mine in between.


-----

MINES (0.24%)

I suspect that removing this and MISSED_FOOTSWITCH 