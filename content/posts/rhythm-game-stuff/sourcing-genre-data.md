---
draft: false
date: 2025-12-15T00:57:30
params:
  author: Mike Votaw
title: Sourcing Genre Data for (Slightly Obscure) Music is Hard
---


I've been playing dance games for over 20 years now, and one thing that has always kind of bothered me was the inability to sort/filter songs by genre. I can't think of any official rhythm games, besides Rock Band and Guitar Hero, that provide meaningful genres for their songs, and that's honestly kind of ridiculous. These are _music_ games, isn't the whole point is to play songs that you enjoy?

The community-built games aren't much better. With ITG, it's not uncommon for players to have several thousand songs loaded into their game. And there's probably somewhere on the order of 50-75 thousand songs readily available for download. These songs are typically grouped into "packs" that are released either by step artists, or by event organizers, and these can range from 10 to several hundred songs. For new/casual players, this is a wildly intimidating number of options.

I think we've found ourselves in an unfortunate cycle. Stepmania has had support for a `#GENRE` tag since probably forever, but step artists have never bothered setting a value for their songs (or if they do, it's either something hyper-specific like [Pop'n Music's genres](https://remywiki.com/Pop%27n_music_Genre_List), or just some non-genre value). And since no songs have genres set, no-one can make use of it in-game. And since nobody bothers using it in-game, step artists don't bother with filling it out.

So I did what any sane person would do, and have spent the past year and a half thinking on and slowly working on a way to solve this problem. To be fair, I didn't think that it was going to take this long. In the amount of time that it's taken me to _not_ build a good solution to this, I probably could have just hand-annotated my relatively small collection of stepfiles, but where's the fun in that?

> We do these things not because they are easy, but because we thought they were going to be easy
>
>   -- _Someone, probably_

## Problems

### Problem 1: Messy song titles and artists

This was a problem that I first encountered when I was building a web app for [generating Spotify playlists from Stepmania song packs](https://github.com/mjvotaw/sm-to-playlist). 



Common issues include things like:

Stepfiles might list a featured artist as part of the song title:

```
#TITLE:Something Real (feat. Danyka Nadeau);
#ARTIST:Rameses B;
```

Or multiple artists might be listed in several different ways:

```
#ARTIST:Droptek & Vorso
...
#ARTIST:Dirtcaps x Gerald Le Funk
...
#ARTIST:DJ Ostkurve feat. David Hasselhoff;
...
#ARTIST:Deadmau5 ft. Wolfgang Gartner;
...
#ARTIST:Miyu Tomita, Saori Oonishi, Naomi Oozora, Kana Hanazawa;
```

Or the `#SUBTITLE` might include additional artists, some detail about the stepfile, or other song info: :

```
#SUBTITLE:(feat. DJ Snake);
...
#SUBTITLE:(No CMOD);
...
#SUBTITLE:(Japanese Version);
...
#SUBTITLE:(Speedycake Remix);
...
#SUBTITLE:(Pa's Lam System Remix) (No CMOD);
...
#SUBTITLE:[Psystyle!-And More Genre Switches];
```

Song titles might include other information (such as stepfiles from certain tournament packs):

```
#TITLE:[1372] [07] Beat Radiance (Medium);
```

This is all complicated by the fact that sites that provide access to song data all have slightly different ways of keeping track of things like additional artists.

### Problem 2: Messy genre tags

Assuming we were able to match a song based on the stepfile's info, the data coming from places like Last.fm or Discogs is user-provided, which means it's potentially just as messy and inconsistent as the stepfiles themselves.

Last.fm simply provides "tags", which might include things like "90s", or "female vocalists", and might include several different genres.


### Problem 3: Lack of good data for slightly obscure music

Sites like [last.fm](https://last.fm) or [discogs](https://discogs.com) are great for sourcing data for relatively popular music. But since all of this data is provided by users, less popular songs/artists will necessarily have fewer tags. And this is compounded by the fact that, as of right now, there's an apparent bug in last.fm's api, where it won't return tags for songs that fall under some unknown threshold, despite the website displaying tags for that song.

### Problem 4: A Lot of these songs aren't "real" songs

A lot of the content released by the ITG community use songs that are pulled from other music games. And it seems that most companies producing music games have leaned very heavily towards releasing songs that were created specifically for their game. I suspect this is mostly to avoid having to deal with licensing issues. For instance, in the newest versions of Dance Dance Revolution, most of my favorite songs from the older games are missing, because those songs were licensed from [Dancemania](https://en.wikipedia.org/wiki/Dancemania). I guess Konami didn't want to keep paying to license music that only really appeals to people in their 30's and 40's.

And then there's also a lot of content that's pulled from things like anime or other video game soundtracks. Most of this stuff doesn't really get released as "real" songs, and if they do, they fall under Problem 3 of being too obscure to have useful info available.

### Problem 5: People don't agree on things

I have a suspicion that another reason why using the `#GENRE` tag never caught on is because people just love to over-categorize things and then argue about them. And then we'd end up with the same problem that games like Pop'n Music or IIDX have, where each song has some super-specific genre that other songs don't fit into. What's the point of having a genre if only one song is tagged with it? And dance music often doesn't fit neatly into just one genre anyway.

Being limited to just one `#GENRE` tag isn't ideal. What I'd really like to see is added support for multiple genres, either in some sort of hierarchical list of genres, or just some more generic "tags" option.

### Problem 6: This is probably breaking T's & C's

Discogs helpfully provides rate-limiting headers, and returns `429` errors if I hit their api too quickly. But Last.fm just seems to hang up and stop responding after a while, which isn't cool. But this is almost certainly _not_ the intended use for these apis.

## Solutions

### Cleaning up messy data

I ended up writing a python library that I'm calling [fuzzytrackmatch](https://github.com/mjvotaw/fuzzytrackmatch), which tries to handle the first two problems. Given a title, artist, and optional subtitle string, it will normalize this data into a title and a list of artists, then makes several api calls with different combinations of the normalized and un-normalized data, and then filter out results that don't meet some similarity threshold with the title and artists requested.

It also handles trying to figure out genre info from the returned data. I took inspiration from the [lastgenre plugin](https://github.com/beetbox/beets/blob/master/beetsplug/lastgenre/__init__.py) for the [beets media library manager](https://beets.io/), which uses a hierarchical list of "canonical" genres, and tries to match the given tags to it. I've expanded the list of genres a bit, added a list of genre aliases, and added some other small tweaks to try to maximize the odds of finding a valid genre.

### Finding more sources for data

Because of course there is, there's a website that catalogs anime themes, [animethemes.moe](https://animethemes.moe/). It provides an api for searching anime themes based on the show/movie name or song title.

The community-built game [osu!](https://osu.ppy.sh/) allows players to tag songs, which could be a good source. They've got a slightly annoying problem that all of their tags come back as a space-delimited string.

Someone also built a tool for scraping song info from a number of rhythm game websites called [arcade-songs-fetch](https://github.com/zetaraku/arcade-songs-fetch). This could be handy for building a cache of songs known to come from other rhythm games.


## Other things that got explored

### Machine learning models

There are a number of models out there trained to predict music genres, but they're mostly academic exercises that aren't terribly accurate.

One model that I found that looked somewhat promising is from[Essentia](https://essentia.upf.edu/). They offer several models that are trained on millions of songs based on a dataset from Discogs. My initial tests weren't too promising, though. It seems to provide a lot of equally-likely results, which makes it hard to choose a single result with confidence. This isn't too surprising, I mean especially with dance music, there's a _lot_ of stylistic overlap between genres.

And it's not exactly quick. This isn't something that I'd be able to package into an application for end-users.





