# dis.co.vu

The product of 3 nights of frantic work - I'd originally intended to plaster this on a domain I had hanging around but my EC2 free year was running out. A little thing for show - something I could've done in Pipes in 5 minutes - that searches Twitter for tweets around you (although I'll be damned with HTML5 geolocation's worked outside the box on any machine I have close to hand), and pops them up in a bubble on a map. Written in client-heavy JS: I'd intended to learn about Google's Maps API but instead learned more about embracing asynchronicity in a language that's only just recieved a very limited capacity for multithreading.

You'll need to stash a copy of the Google Maps Utility Library's infobox.js in the same directory yourself, for licensing reasons. But after that opening the lone html file will work peachy.

## Licensing

Public domain. God knows anyone would want to use my code anyway.

## Attributions

Uses underscore.js (<3), the GMaps API, and infobox.js from the GMaps Utilities. I bundle infobox.js locally - it uses the Apache license.