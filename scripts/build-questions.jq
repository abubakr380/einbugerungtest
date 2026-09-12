.[0] as $core
| .[1] as $rich
| ($rich | map({ key: .id, value: . }) | from_entries) as $by_id
| [
  $core[]
  | . as $base
  | ($by_id[$base.id] // {}) as $extra
  | ($base + $extra + { num: $base.num, id: $base.id }) as $q
  | select((($q.num | test("^[0-9]+$")) and (($q.num | tonumber) <= 300)) or ($q.num | startswith("BE-")))
  | {
      num: $q.num,
      question: $q.question,
      a: $q.a,
      b: $q.b,
      c: $q.c,
      d: $q.d,
      solution: $q.solution,
      image: (
        if $q.image == "-" or $q.image == null then null
        else "assets/questions/" + ($q.num | gsub("-"; "_") | ascii_downcase) +
          (if ($q.image | endswith(".jpeg")) then ".jpeg" else ".png" end)
        end
      ),
      category: (($q.category // "General") | gsub("^'|'$"; "")),
      context: ($q.context // "Die richtige Antwort ergibt sich aus dem offiziellen BAMF-Fragenkatalog."),
      en: {
        question: ($q.translation.en.question // ""),
        a: ($q.translation.en.a // ""),
        b: ($q.translation.en.b // ""),
        c: ($q.translation.en.c // ""),
        d: ($q.translation.en.d // ""),
        context: ($q.translation.en.context // "The correct answer follows from the official BAMF question catalog.")
      }
    }
]
