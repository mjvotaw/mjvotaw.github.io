---
draft: false
date: 2025-03-02
params:
  author: Mike Votaw
title: Predicting Foot Placement for 4-Panel Dance Games
---


This writeup, and the code it's meant to accompany, are still a bit of a work in progress. In particular, while working on this writeup, I realized that there's probably a simpler way to represent a lot of the data, but I haven't had the time to work it out yet.

There's currenty two implementations of this: one in Typescript for [SMEditor](https://github.com/mjvotaw/sm-annotation/blob/tech-counts-editor/app/src/util/ParityGenInternals.ts) and one in C++ for [ITGMania](https://github.com/itgmania/itgmania/blob/beta/src/StepParityGenerator.cpp). They've diverged in their specifics, but I've done my best to keep their overall function in sync.

This work was not done in a vacuum. The groundwork was laid by tillvit's implementation of this algorithm as an experimental feature of [SMEditor](https://github.com/tillvit/smeditor). A lot of my efforts were initially focused on improving the performance and readability of this implementation, and that was followed by a long process of iterating on the cost functions used. This writeup focuses mainly on the cost calculations performed, and is an attempt to explain the rationale behind them. I'll include links to relevant parts of the code for both implementations.


## What's so hard about this?

For simple cases, predicting how a player will hit a note isn't actually all that difficult. There's three basic assumptions that you can work with that will cover probably 90% of most step charts:

- players generally want to be facing forward
- players prefer to alternate feet when pressing notes
- players prefer to minimize the amount of movement made when pressing jumps

The remaining 10%, however, consists mostly of what the community refers to as ["tech"](https://itgwiki.dominick.cc/en/playstyles/technical-and-fantastic-attack). This includes things like:

<div class="row">
  <div class="col">
    <p class="text-center"><strong>Brackets</strong> <br /> (hitting two notes with one foot)</p>

```stepchart {animate=true size=48 quantization=16 showstage=true maxvisiblerows=4 xmod=1}
#BPMS:0.000=190.000;
#NOTES:
dance-single:
     32 Jacks:
     Beginner:
     1:
     0,0,0,0,0:
1000
0101
0010
0001
1100
0000
0000
0000
;

```

  </div>

  <div class="col">
    <p class="text-center"><strong>Footswitches</strong> <br /> (consecutive notes hit with alternating feet)</p>

```stepchart {animate=true size=48 quantization=16 showstage=true maxvisiblerows=4 xmod=1}
#BPMS:0.000=190.000;
#NOTES:
dance-single:
     32 Jacks:
     Beginner:
     1:
     0,0,0,0,0:
0001
0000
0100
00M0
0100
0000
1000
0000
;

```

  </div>
</div>

<div class="row">
  <div class="col">
    <p class="text-center"><strong>Jacks</strong> <br /> (consecutive notes hit with the same foot)</p>

```stepchart {animate=true size=48 quantization=16 showstage=true maxvisiblerows=4 xmod=1}
#BPMS:0.000=190.000;
#NOTES:
dance-single:
     32 Jacks:
     Beginner:
     1:
     0,0,0,0,0:
0001
0000
0100
0000
0100
0000
0010
0000
;

```

  </div>

  <div class="col">
    <p class="text-center"> <strong>Crossovers</strong> <br /> (crossing feet over the center to hit notes)</p>

```stepchart {animate=true size=48 quantization=16 showstage=true maxvisiblerows=4 xmod=1}
#BPMS:0.000=190.000;
#NOTES:
dance-single:
     32 Jacks:
     Beginner:
     1:
     0,0,0,0,0:
0001
0100
1000
0100
0001
1000
0100
0001
;

```

  </div>
</div>

<br />
They're basically just fancy ways of tapping the arrows, used to make step charts more complicated. For my use case, though, getting this 10% correct is very important. 

### Alright, so how does this work

The general idea is that we need to build a graph, with each node representing one possible state (a foot placement for a given point in time), and each edge representing the difficulty of moving from one state to the next. There's two interesting parts to this: determining the possible foot placements, and calculating the movement difficulties.

## Data structures and concepts

Before getting too deep into things, let's define some concepts.

The **dance stage** is represented as points on a 3x3 grid (or 6x3 in the case of doubles), where 0,0 is the left bottom (or farthest from the screen). So for singles, this looks like:

```
left:  0,1
down:  1,0
up:    1,2
right: 2,1
```

These are essentially unitless, but if it makes it easier to think about it, each panel on a DDR dance stage is roughly 1ft square.

This data is represented as a *StageLayout* object, which contains an array of *StagePoints* containing the coordinates of each arrow, along with some other useful information like the  number of columns, which columns are considered "up", "down", or "side" arrows.

```js
interface StagePoint {
  x: number
  y: number
}

interface StageLayout {
  layout: StagePoint[]
  columnCount: number
  upArrows: number[]
  downArrows: number[]
  sideArrows: number[]
}
```
<br />
<br />

The **step chart** is represented as a series of *Rows*, where each row contains one or more *Notes*. The notes in a row are laid out in columns, zero-indexed, ordered as left, down, up, right. Each note is one of several note types:

- a **Tap** is a standard note
- a **Hold Head** is the beginning of a hold or roll (these are currently treated as equivalent for our purposes)
- a **Hold Tail** is the end of a hold or roll note
- a **Mine** is a note that is to be avoided

(There are other note types (lifts, fakes) that we're not concerned about right now)

Besides the notes in the row, we also want to keep track of the time that a row occurs, as well as things like note count, whether any hold notes are currently being held (remember that there is no "hold body" defined in Stepmania), and whether there any notes were preceded by a mine.

```js

enum NoteType {
  None = "0"
  Tap = "1"
  HoldHead = "2"
  RollHead = "3"
  HoldTail = "4"
  Mine = "M"
}

interface Note {
  column: number
  type: NoteType
  hold?: number 
}

interface Row {
  time: number
  notes: Note[]
  holds: 
  noteCount: number
}
```

Each *Node* of the graph contains a given *State*, which represents a specific row of the step chart, with a specific foot positioning. Foot positioning is tracked by indicating which part of the foot is on which arrow.

This is still a work in progress in my opinion, I'm still trying to come up with a more clear way to represent this information.

```js

enum FootPart {
  None
  LeftHeel
  LeftToe
  RightHeel
  RightToe
}

interface State {
  rowIndex: number
  time: number
  columns: FootPart[]
}

interface Node {
  state: State
  neighbors: Map<number, Node>
}

```

This is all somewhat simplified from what has actually ended up being implemented. Partly because it's computationally cheaper to pre-compute some data for things like the States, and partly because, about halfway through writing this, I realized a 

### Determining possible foot placements

For the vast majority of steps in a step chart, we really only have two possible foot placements: the player presses the note either with their left foot, or with their right. This applies to single notes and non-bracketable jumps. But, as I mentioned earlier, tech make all of this more complicated.

For instance, with a single bracketable jump, we now have 6 possible foot placements.

It could be a regular jump:
<div class="row">
  <div class="col">

  ```stepchart {size=48 showstage=true}
  0101 LR
  ```

  </div>

  <div class="col">

  ```stepchart {size=48 showstage=true }
  0101 RL
  ```

  </div>
</div>

Or it could be a bracket of some kind:
<div class="row">
  <div class="col">

  ```stepchart {size=48 showstage=true initialright=2 }
  0101 Ll
  ```

  </div>
  <div class="col">

  ```stepchart {size=48 showstage=true initialright=2 }
  0101 lL
  ```

  </div>

  <div class="col">

  ```stepchart {size=48 showstage=true }
  0101 Rr
  ```

  </div>
  <div class="col">

  ```stepchart {size=48 showstage=true }
  0101 rR
  ```

  </div>
</div>

Hold notes also complicate matters. Tapping a note while holding another has something like 8 possible foot placements, due to the fact that we have to consider that the player might execute a holdswitch or a bracket tap. 

Granted, most of these positions are unlikely, and some aren't really physically possible. But I've found that it's very difficult to make assumptions about which positions could be considered "valid", because the context of what notes came before, and what notes come after, is very important. That, and I just know that the moment I try to eliminate some "invalid" moves, someone is going to release a chart that explicitly wants players to perform them.

It's also worth pointing out that, besides brackets, I don't try to predict whether the player will tap an arrow specifically with the heel or the toes of their foot. This is done because, frankly, that would just make all of this even harder than it already is, and, for my purposes, that information isn't that important.

# Calculating movement difficulties

After a good deal of experimenting and analyis, I've ended up with a set of 14 different cost functions and associated weights, that make the total difficulty. They can be broken down into four categories:
- [Basic Movement](#basic-movement)
- [Brackets](#brackets)
- [Footswitches vs Jacks](#footswitches-and-jacks)
- [Other Obscure Stuff](#other-obscure-stuff)

And then at the end there's some costs that still remain in the coddebase, [but aren't actually getting used anymore](#other-costs-that-arent-getting-used-anymore).



## Basic Movement

First, the basic movement costs: [Distance](#distance), [Facing](#facing), and [Doublestep](#doublestep).

These three costs alone do a pretty good job of predicting a player's movement, especially on easier, non-technical charts, and *especially* if you don't want to bother with predicting brackets.

### Distance

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L890) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L563)

Generally speaking, this is fairly simple, we're just calculating the distance that each foot (or part of the foot) moved from the previous state to the result state. 
The shorter the elapsed time between this state and the previous, the higher the cost (the elapsed time tends to be < 1)

But there a few wrinkles to this.

We want the way that this is calculated to handle brackets consistently. For instance, a movement like this:

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0101 Rr
```

should probably incur the same cost as this:

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0011 rR
```

because in practice, these movements are both fairly small.

But, a movement like this should incur a normal cost, since the right foot is moving to a completely different set of arrows.
```stepchart {quantization=8 showstage=true animate=true size=48}
0010 R
1000 L
0101 Rr
```

In a situation where the player is moving from one bracket to another, we don't want to accidentally double-count the movement. This should incur the same cost as the previous example:

```stepchart {quantization=8 showstage=true animate=true size=48}
0011 rR
1000 L
0101 Rr
```


### Facing

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L702) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L361)

The goal of this is to make movements that turn the player away from the screen heavier costs.
So we take the resulting position, and figure out how far from the screen the player is turned.

Roughly:
```
dx = right.x - left.x
dy = right.y - left.y

dist = sqrt(dx^2 + dy^2)

cosineOfAngle = dx/dist
```
This gives us the degree of turning, just without an indication of which direction.

1 == facing directly at the screen

```stepchart {quantization=8 showstage=true size=48}
1001 LR
```

0 == 90 degrees
<div class="row">
  <div class="col">
  
  ```stepchart {quantization=8 showstage=true size=48}
  0110 LR
  ```

  </div>
  
  <div class="col">
  
  ```stepchart {quantization=8 showstage=true size=48}
  0110 RL
  ```

  </div>
</div>

-1 == facing directly away

```stepchart {quantization=8 showstage=true size=48}
1001 RL
```

Any value that's >= 0 will have a cost of 0.

And we want this to scale exponentially as the value approaches -1, so that something like .L.R is less costly than R..L


### Doublestep

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L556) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L273)

In this context, a doublestep is any time the player hits a note with one foot, and then uses that same foot to hit a different note on the next row.

We want to minimize *unforced* doublesteps, while allowing *forced* doublesteps.

An unforced doublestep is something like:

```stepchart {quantization=8 showstage=true animate=true size=48}
1000 L
0100 R
0001 R
```

A forced doublestep could be due the other foot holding a hold arrow:

<div class="row">
<div class="col">

```stepchart {quantization=8 showstage=true animate=true size=48}
2000 L
0100 LR
0001 LR
3000 L
```

</div>
<div class="col">


```stepchart {quantization=8 showstage=true animate=true size=48}
2000 L
0100 LR
3001 LR
0000
```

</div>
</div>

are obviously forced, but we also consider some cases where the hold arrow ends before
the next note, but after the previous to be "forced"

```stepchart {quantization=16 showstage=true animate=true size=48}
2000 LR
0000
0100 LR
0000 
0000
3000 L
0001 R
```

could be considered "forced", assuming that the player is holding the note for its entire duration.

But something like

```stepchart {quantization=8 showstage=true animate=true size=48}
2000 L
0100 LR
3000 L
0000
0000
0001 R
```

Shouldn't be considered forced, since there's plenty of time to move your left foot in this case.

And obviously if the hold ends on the same row as the previous step, then it's an unforced doublestep:

```stepchart {quantization=8 showstage=true animate=true size=48}
2000 L
0000
3100 LR
0001 R
0000
```

And then of course there are things that just aren't doublesteps at all.

If a jump is involed, we don't want to consider it a doublestep:

<div class="row">
<div class="col">

```stepchart {quantization=8 showstage=true animate=true size=48}
1000 L
0100 R
0011 LR
0000
```

</div>
<div class="col">

```stepchart {quantization=8 showstage=true animate=true size=48}
1000 L
1100 LR
0001 R
0000
```

</div>
</div>

The actual implementation of this is pretty messy right now, mostly due to how hold notes are tracked, but it basically boils down to:

- Is there a jump in the result state? Not a double step
- Was there a jump in the previous state? Not a double step
- Did the player hit a note with one foot in the previous state, and then use that foot to hit a *different note* this state? This is a double step.
- If so, are they actively holding, or just recently released, a hold note with their other foot? Then this is a forced double step, and incurs no penalty.
- Otherwise, this is an unforced doublestep, and should incur a penalty.

It's fairly common for these costs to be scaled by the time elapsed between rows, with the thinking that quicker movements are harder to perform. But in the case of doublestepping, this is something that is just generally avoided by players, regardless of the speed, so this has a static cost.


-----

## BRACKETS


As mentioned above, these three costs cover probably 90% of all of the steps in most step charts. 

But the whole reason why this is being done is to predict that remaining 10% accurately, so that we can then calculate tech counts accurately.

From here, we begin moving into increasingly tech-specific costs that are designed to nudge the prediction towards or away from brackets, jacks, footswitches.

First, let's take a look at bracket-related costs.

Deciding when it makes sense to bracket something vs treating it as a regular jump took a long time to get right. The line between "could be bracketed" and "should/supposed to be bracketed" is a little subjective. My goal was to emphasize bracketing when it made sense, but not over-emphasize it.
The original algorithm way over-emphasized bracketing by having jumps incur a specific cost that almost always made them more expensive than bracketing, so that got removed.

Twisted Foot and Slow Bracket ended up being the pieces that I needed 


### Twisted Foot

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L673) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L273)

This is intended to prevent the algorithm from selecting "convenient" (in the sense that the move could be considered less costly), but damn near impossible foot positions.

Without this cost, it's common for the algorithm to select

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0011 Rr
1000 L
0001 R
```

over

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0011 rR
1000 L
0001 R
```

Because the cost of the first ends up being lower due to technically moving your right foot less.

This one was kind of difficult to figure out. I'd considered trying to eliminate these positions from being considered at all, but it's difficult to know if a player's foot is actually twisted backwards for a given row without additional context. And I didn't want to risk eliminating a potentially valid foot placement for some wild tech chart that wasn't taken into account.

Because we need to catch things like

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
0100 L
0011 Rr
0100 L
```

while still allowing something like

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
0100 L
1010 rR
0100 L
```

since that would probably be more comfortable to perform than

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
0100 L
1010 Rr
0100 L
```

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

### Slow Bracket
[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L650) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L307)


This one is pretty simple. The more time a player has between notes, the less likely it is that they're "supposed" to bracket a given jump.

<div class="row">
<div class="col">

```stepchart {quantization=8 showstage=true animate=true size=48 bpm=200}
1000 L
0101 Rr
0010 L
0000
```
</div>
<div class="col">

```stepchart {quantization=8 showstage=true animate=true size=48 bpm=130}
1000 L
0000
0101 LR
0000
0010 R
```

</div>
</div>

After some experimentation, a threshold of 0.15 seconds (1/16th notes at 100bpm, or 1/8th notes at 200bpm) was decided on.

- First, obviously check that the player is bracketing something
- Get the elapsed time between the result state and previous state.
- If it's less than the threshold, then no penalty
- Otherwise, take the difference between the elapsed time and the threshold, and multiply it by SLOWBRACKET. In our case, this is set at 400.

This results in a cost that starts pretty small and slowly grows with the elapsed time.

-----

## FOOTSWITCHES AND JACKS

Now let's look at footswitch/jack specific costs.

Footswitches are commonly notated with the addition of a mine to act as a visual indicator that the player should footswitch on a given set of notes

```stepchart {quantization=16 showstage=true animate=true size=48}
0001 R
0000
1000 L
0000
0100 R
00M0
0100 L
0000 
0001 R
0000
```

Without this indication, it can be difficult to determine whether you should footswitch or jack, as performing the wrong maneuver will leave you on the wrong foot for performing the rest of the phrase:


```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0100 R
0100 R
```

vs

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0100 R
0100 L
```

could both be valid, depending on what follows. For instance, this phrase would probably be less awkward with a footswitch:

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0100 R
0100 R
0001 R
0010 L
```

While this would probably be less awkward with a jack:

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
0100 R
0100 L
1000 L
0001 R
```


There's four separate costs here that help nudge things: Slow Footswitch, Sideswitch, Jack, and Missed Footswitch


### Slow Footswitch

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L775) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L496)


In general, the faster a pattern of repeating notes is, the most likely that the player will want to footswitch it. Below a certain speed, some players might actually find footswitches more awkward to perform than a jack.

So the first part of this cost is checking if the elapsed time is above a certain threshold. Anything faster than this threshold will incur no cost for footswitching.

And, as mentioned above, if the repeating notes have a mine placed in between them, then this is likely a notation indicating that this should be footswitched, and so there's no cost, regardless of the speed.

Otherwise, we want to generate a cost that scales inverse to the speed of the footswitch, so that slower footswitches are penalized more.

To do this, I'm taking `((elapsedTime - threshold) / elapsedTime) * FOOTSWITCH`. So as elapsedTime grows, the calculated cost approaches FOOTSWITCH. Another way to look at that would be `(1 - (threshold/elapsedTime)) * FOOTSWITCH`.


I have the threshold set at 0.2 seconds (1/8th note at 150bpm), and FOOTSWITCH set to 325. This seems to be a good balance.


So the general idea here is:

- Figure out if the player is footswitching
- Check if the footswitch is happening quicker than a given threshold
- Check if the footswitch has been notated
- If not, calculate a scaling factor based on elapsedTime


### Jack
[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L870) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L549)

As sort of mentioned above, repeating notes are harder to hit with the same foot as their speed increases. 

The goal here is to make the jack more costly than the footswitch, primarily by being more costly than the cost calculated by DISTANCE.

```
TODO: I need to redo this writeup.

I was originally using a scaled cost for this, but in writing this I realized that it was actually doing the opposite of what I intended, which was heavily penalizing jacks that were near the threshold and then scaling towards zero as the elapsedTime got quicker.

For now I think I'm going to use just a constant value
```


### Sideswitch
[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L821) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L530)

A specific variation of a footswitch, the sideswitch is considered slightly more difficult to perform than a footswitch on the up or down arrow.

So this is basically just checking if there's a footswitch happening on either the left or right arrow.

-----

## Other Obscure Stuff

From here, we get into more obscure things.


### Bracket Tap

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L429) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L159)

This is when the player trys to tap a note with one part of their foot while holding a note with the other.

```stepchart {quantization=8 showstage=true animate=true size=48}
2000 L
0100 lL
3000 L
0000
```


This cost is necessary to keep the algorithm from always choosing this, since it would otherwise be less costly, since the left foot wouldn't incur any movement penalty.

This basically comes down to:
- Is part of one foot holding a note
- Is the other tapping a note

The current cost calculation checks if part of the foot moved in the previous state, and if so, lessens the cost. I'm honestly not sure why.


### Bracket Jack

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L521) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L244)

This is when a player hits a bracket right after stepping on arrow

```stepchart {quantization=8 showstage=true animate=true size=48}
0001 R
1000 L
1100 lL
0000
```

Steps like this are *usually* not intended to be brackets. So this incurs a very small penalty (it's currently set to 20) just to nudge the algorithm away from choosing this. Like the Bracket Tap, this would otherwise be considered less costly since the left foot isn't moving much.

Current calculation looks like:

- Check that there are no holds
- Check that only the left or right foot has moved
- Check that the previous row wasn't a jump
- Then check that this is in fact a jack, and that both parts of the foot are being used


### Holdswitch

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L399) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L122)

A holdswitch is exactly what it sounds like: the player quickly swaps feet so that the other foot is now holding a note, and the original foot is now tapping a note.

```stepchart {quantization=8 showstage=true animate=true size=48}
0200 L
0010 LR
1000 LR
0300 R
```

I can't come up with a good example of this right now. This is something that's well outside of my skill range.

Like the BRACKETTAP cost, this cost is necessary to keep the algorithm from choosing this unnecessarily.

If there are any active holds, check the previous state to see if the same foot is holding the note.
If not, incur a penalty multiplied by the distance that foot had to move to hit the new note.


### Spin

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L719) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L431)

When I started writing this all up, I wasn't sure if this cost was really even necessary, as it seems like FACING should be handling this, but it seems to basically prevent crossovers from becoming spins.

Basically what you're checking is
 - Is right.x < left.x for this state and the previous state
 - Was right.y < left.y in the previous state, but now right.y > left.y, or the opposite (was right.y > left.y in the previous state, but now right.y < left.y)
 - If so, add a kind of heavy cost to keep the algorithm from picking this (currently set to 1000)


----- 

### Missed Footswitch

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L847) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L345)

This is basically meant to further emphasize footswitches that have been notated with a mine should be chosen over jacks, by penalizing jacks that occur with a mine in between.

<div class="row">
<div class="col">

```stepchart {quantization=16 showstage=true animate=true size=48}
1000 L
0000
0100 R
00M0
0100 L
0000
0001 R
```

</div>
<div class="col">

```stepchart {quantization=16 showstage=true animate=true size=48}
1000 L
0000
0100 R
00M0
0100 R
0000
0001 L
```

</div>
</div>


### Mine

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L388) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L105)

This cost forces the algorithm to select foot positions that avoid hitting mines, by applying a heavy cost to any foot positions that would leave a foot on a note when it would be hitting a mine.


-------

## Other Costs That Aren't Getting Used Anymore

While fine-tuning this algorithm, there were a few cost calculations that turned out to be unnecessary, either because they didn't contribute any meaningful change to the resulting foot positions, or they actively caused the algorithm to choose bad foot placements. Why are they even still in the code? I don't know! I just haven't gotten around to reallly finalizing things I guess. If you look at the cost weights, these are all marked as `0`.

### Other

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L484) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L210)

The full name of this is something like "moving a foot while the other foot isn't on the pad", which is about what it sounds like. I think this would only applies to steps that follow a mine that caused the player to have to lift a foot. And if this supported lifts, I guess it would apply to that too.

### Crowded Bracket

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L933) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L606)

The idea behind this one was to dissuade the algorithm from choosing foot positions where one foot would bracket a note where the other foot currently was. 

I can't think of a good example of this, but something like:

```stepchart {quantization=8 showstage=true animate=true size=48}
1000 L
0100 R
0101 Ll
0010 R
```


But I think I came up with this before I realized that jumps were being actively penalized, and it was trying to counteract the algorithm's heavy preference for brackets.

### Jump

[TS](https://github.com/mjvotaw/sm-annotation/blob/f24e671f6972b572c4f989bbbf42b7ab199ba628/app/src/util/ParityCost.ts#L630) [C++](https://github.com/itgmania/itgmania/blob/2feb9e784cee7c94840f8d9461a66cd53ce7d7c8/src/StepParityCost.cpp#L291)

As mentioned already, the algorithm was originally penalizing any jumps, scaled to be more costly the quicker they were being performed. After some fine tuning, I realized that this was causing the algorithm to almost always select brackets over jumps, even in situations that didn't really call for it. Part of this could also be a change in intention, where we now only want to select brackets when we can reasonably assume that it's the "right" or "intended" way to perform the chart.

