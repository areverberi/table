# table
Spreadsheet collaboration tool in Node.js. Uses a (slightly) modified version of Slickgrid for the front-end and js-xlsx to generate and parse xlsx files.
The database backend is mongodb.
## Installation
cloning the database and then running
```
node table.js
```
should be enough. alternatively, use pm2:
```
pm2 table.js
```
##Usage
- A new worksheet named newworksheet is created by going to (assuming the node server is running on localhost:1337) localhost:1337/t/newworksheet.
Use the same link to access it later on. 
- To download the worksheet in xlsx, use the /d/worsheet route.
- A worksheet can be cloned using the /clone/worsheet/to/worksheetclone route
- A worksheet can be cloned using the /rename/worksheet/to/newworsheet route
- Delete using the /del/worksheet route
- Available formatting options for the worksheets are background coloring (using the Spectrum palette), column width (just dragging the headers), bold and italic fonts and cell borders (available through right-click menu)
