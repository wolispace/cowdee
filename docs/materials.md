In an attempt to redue the amount of code people white I want to introduce 'materials'

eg 'create a material called glass'
or 'create a material called bot'

If you then 'create a bottle made of glass'
or 'create a glass bottle'
or 'create a glass'
or 'create a bunny made of bot'

we need to find the matching materials based on the name.
then attach those materials to the obj.materials
eg: obj.materials = ['glass','frozen','glowing']

When saving an object, if it has obj.materials then
find all 'material called x' and attach its code to the objects code when indexing.. but not saving!

All materials should be added first, then finally the objects
- so an object can override a material sub.

Saving will populate trigger_ and tick_ based on the code.

When finding reacting objects based on tick or trigger, we need to also find all materials and append them to the obj.code, before runsub 

eg: create a bunny made of bot
uses the 'tick: romame;##roamme: go $Loc, random doorway;' code from 'material called bot'
so trigger_tick gets the bunny's id but executes the materials code.

This does mean loading up all material code each time we want an object that has a material, and many will.
