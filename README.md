# Exploring Kinship Ties: the Prut Family of Hadley

A map story by Sulaiman Moukheiber and Max Hunt (Worcester Polytechnic Institute), in partnership with Historic New England. Draft for review.

[Open the map and story](https://sul24mib.github.io/IQP-Kingship-T/) · [Explore the family and community ties](https://sul24mib.github.io/IQP-Kingship-T/explorer.html)

[![Live demo of the Prut family map, Cloe’s chart of family and community ties, and the source behind a selected connection.](kinship-explorer.gif)](https://sul24mib.github.io/IQP-Kingship-T/explorer.html)

From **Meet the family** on the map, choose **Explore their connections**. The chart and historical records open over the story. **Back to the map** or **Escape** returns you to the same chapter. The recording starts on the map, then follows Cloe Prut in the explorer. Select **Community** in the bar chart to see Hagar and Pomp Dorus. Select a name in the diagram to read the evidence.

| Visualization | Interaction | Implementation |
| --- | --- | --- |
| Vega-Lite bar chart | Counts family and community ties for the selected person. Clicking a bar filters the diagram. | [vega-lite-counts.js](js/vega-lite-counts.js) |
| D3.js relationship diagram | Draws one branch per connection. Selecting a name reveals its evidence and confidence. | [d3-network.js](js/d3-network.js) |
| Leaflet story map | Follows the family through locations, commemorative stones, and historical records. | [Original map and story](index.html) |

## Use the explorer in WordPress

Paste the following into a **Custom HTML** block on a site that permits iframe embeds. The controls, chart, diagram and historical sources run inside the embedded page. The separate link remains usable if the editor removes the iframe.

```html
<iframe src="https://sul24mib.github.io/IQP-Kingship-T/explorer.html"
        title="Explore the Prut family’s kinship ties" width="100%" height="850"
        style="border:0" loading="lazy"></iframe>
<p><a href="https://sul24mib.github.io/IQP-Kingship-T/explorer.html">Open the relationship explorer</a></p>
```

On WordPress.com, iframe embeds require a paid plan with hosting features activated. On a site that filters iframes, use the explorer link in a Button block or link the GIF above. [WordPress.com Custom HTML documentation](https://wordpress.com/support/wordpress-editor/blocks/custom-html-block/)

## Project files

- [index.html](index.html) contains the original narrative, Leaflet map and searchable spreadsheet. The connections panel opens from the page header and the family chapter.
- [explorer.html](explorer.html) is an optional relationship explorer and the page to embed in WordPress.
- [js/](js/) contains the [in-story panel](js/story-explorer.js), explorer controls and both chart implementations. [styles/](styles/) contains its stylesheet.
- [data/explorer-data.js](data/explorer-data.js) contains the 26 sourced connections among the 13 people in the family view.
- [images/](images/) contains the original images and the animated demo. The stone photographs are credited to Historic New England in the story.

## Preview and update

Run `python3 -m http.server 8000` here. Open `http://localhost:8000/` for the original map or `http://localhost:8000/explorer.html` for the optional charts.

After the team updates the original map export, run `python3 tools/export_explorer.py` to refresh the optional explorer’s records from the HTML. The script writes only [data/explorer-data.js](data/explorer-data.js).
