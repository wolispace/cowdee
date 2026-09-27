### **1\. The Three Operating Modes of** **find**

* **Exact Match in Location**:

```
find $loc, the cat;
find $loc, player called wolis;

```

Searches the specified location for an object matching that class or specific name[1].

* **Random Selection with Filters**:

```
find $loc, random [filters];

```

Gathers all objects in `$loc` that match your filter flags, counts them, and assigns a randomly selected one to `$found_id`[1].

* **SQL / Global Query**:

```
find where loc = 123 and class = 'cat';

```

Performs a direct database query across the entire system rather than restricting the scope to a single room[1].

---

### **2\. Available Filter Flags for** **random**

When using `find $loc, random ...`, you can combine any of the following keyword filters:

#### **Target Exclusions**

* **not me**: Excludes the acting object (`$actor`) running the script so it doesn't accidentally target itself[4][5].

#### **Entity Types**

* **player**: Restricts search strictly to player entities (`class = 'player'`)[4][5].
* **not player**: Excludes players, matching only props, items, or rooms[4][5].
* **doorway**: Matches only objects that link to another location (`link &gt; 0`)[4][5].
* **not doorway**: Excludes doorways, matching only standard props[4][5].

#### **Property &amp; State Flags**

* **locked**: Matches objects that have a non-empty password set (`pwd &lt;&gt; ''`)[4][5].
* **not locked**: Matches unlocked objects[4][5].
* **edited**: Matches objects that have written text inside their `info` field (`info &lt;&gt; ''`)[4][5].
* **not edited**: Matches unwritten/blank objects[4][5].
* **lost**: Finds orphaned objects whose location ID points to an object that no longer exists[4][5].
* **where ((...))**: Appends custom SQL logic directly to the filter list[4].

---

### **3\. Example Usage Combinations**

You can string multiple filters together in a single statement[5]:

* **Find any un-pushed prop in the room that isn't you or an exit:**

```
find $loc, random not doorway not me;

```

* **Find a random unlocked player in the room:**

```
find $loc, random player not locked;

```

* **Find a random object inside a container or actor:**

```
find $actor, random;

```

---

### **4\. Variables Populated After** **find** **Executes**

Whenever `find` completes, the engine sets the following global execution context variables for your script to use:

* **$found\_id**: Holds the Object ID of the matched item (or `0` if nothing was found)[4][8].
* **$get\_player**: Populated with the class name if the found object is a player[4].
* **$found\_count**: Stores the total number of objects in the room that matched the filter criteria before the random pick was made[4].

