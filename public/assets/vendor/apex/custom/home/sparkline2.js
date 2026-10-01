// Sparkline 3
var options3 = {
	series: [
		{
			name: "Sessions",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
var chart3 = new ApexCharts(document.querySelector("#sparkline3"), options3);
chart3.render();

// Sparkline 4
var options4 = {
	series: [
		{
			name: "Users",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
var chart4 = new ApexCharts(document.querySelector("#sparkline4"), options4);
chart4.render();

// Sparkline 5
var options5 = {
	series: [
		{
			name: "Pageviews",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
		colors: ["#9e6419"],
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
var chart5 = new ApexCharts(document.querySelector("#sparkline5"), options5);
chart5.render();

// Sparkline 6
var options6 = {
	series: [
		{
			name: "Unique Pageviews",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
		colors: ["#5c646c"],
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
var chart6 = new ApexCharts(document.querySelector("#sparkline6"), options6);
chart6.render();

// Sparkline 7
var options7 = {
	series: [
		{
			name: "Avg Time",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
		colors: ["#2f60a3"],
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
var chart7 = new ApexCharts(document.querySelector("#sparkline7"), options7);
chart7.render();

// Sparkline 8
var options8 = {
	series: [
		{
			name: "Bounce Rate",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
var chart8 = new ApexCharts(document.querySelector("#sparkline8"), options8);
chart8.render();

// Sparkline 9
var options9 = {
	series: [
		{
			name: "Conversion",
			data: [5, 9, 7, 14, 25, 20, 27, 22, 18, 24, 19],
		},
	],
	chart: {
		type: "line",
		width: 90,
		height: 30,
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
var chart9 = new ApexCharts(document.querySelector("#sparkline9"), options9);
chart9.render();
