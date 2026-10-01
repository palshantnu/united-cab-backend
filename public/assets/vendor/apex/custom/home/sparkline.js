// Sparkline 1
var options1 = {
	series: [
		{
			name: "Sales",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 40,
		sparkline: {
			enabled: true,
		},
	},
	xaxis: {
		crosshairs: {
			width: 1,
			categories: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
		},
	},
	stroke: {
		show: true,
		lineCap: "butt",
		colors: ["#e65729"],
		width: 3,
		dashArray: 0,
	},
	tooltip: {
		y: {
			formatter: function (val) {
				return val + " %";
			},
		},
	},
};

var chart1 = new ApexCharts(document.querySelector("#sparkline1"), options1);
chart1.render();

// Sparkline 2
var options2 = {
	series: [
		{
			name: "Revenue",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 40,
		sparkline: {
			enabled: true,
		},
	},
	xaxis: {
		crosshairs: {
			width: 1,
			categories: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"],
		},
	},
	stroke: {
		show: true,
		lineCap: "butt",
		colors: ["#3d8642"],
		width: 3,
		dashArray: 0,
	},
	tooltip: {
		y: {
			formatter: function (val) {
				return val + " %";
			},
		},
	},
};

var chart2 = new ApexCharts(document.querySelector("#sparkline2"), options2);
chart2.render();
