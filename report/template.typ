// The project function defines how your document looks.
// It takes your content and some metadata and formats it.
// Go ahead and customize it to your liking!
#let project(
  title: "",
  authors: (),
  date: none,
  body,
) = {
  // Set the document's basic properties.
  set document(author: authors, title: title)
  set page(
    numbering: "1",
    number-align: center,
    margin: (top: 0.5cm)
  )
  set text(font: "Source Sans Pro", lang: "en")
  show math.equation: set text(font: "Fira Math")
  show raw: set text(font: "Fira Code")
  // Import the logo from the assets folder.
  
  grid(
    columns: (100%, 100%),
    rows: (auto),
    grid.cell(
      colspan: 1,
      align(center)[
        #v(4em)
        #block(text(weight: 700, 1.75em, title))
        #v(1em, weak: true)
        #date
        #v(1em, weak: true)
        #block(link("https://www.github.com/giulianbiolo/asa_agent")[github.com/giulianbiolo/asa_agent])
      ]
    ),
    grid.cell(
      //image("images/abstract_logo_transparent.png", width: 15%)
      //image("images/f1_minimal_logo_transparent.png", width: 15%)
      image("images/f1_style_logo_transparent.png", width: 15%)
    ),
  )


  // Title row.
  // align(center)[
  //   #block(text(weight: 700, 1.75em, title))
  //   #v(1em, weak: true)
  //   #date
  //   #v(1em, weak: true)
  //   #block(link("https://www.github.com/giulianbiolo/asa_agent")[github.com/giulianbiolo/asa_agent])
  // ]

  // Author information.
  pad(
    top: 0.5em,
    bottom: 0.5em,
    x: 2em,
    grid(
      columns: (1fr,) * calc.min(3, authors.len()),
      gutter: 1em,
      ..authors.map(author => align(center, author)),
    ),
  )

  // Main body.
  set par(justify: true)
  set text(hyphenate: false)

  body
}
