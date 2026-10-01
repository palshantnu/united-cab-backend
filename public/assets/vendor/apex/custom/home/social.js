var options = {
	series: [32500, 29700, 24200],
	chart: {
		height: 258,
		type: "polarArea",
	},
	labels: ["Google", "Bing", "Yahoo"],
	fill: {
		opacity: 1,
	},
	stroke: {
		width: 1,
		colors: ["#FFFFFF"],
	},
	colors: ["#3659cd", "#a5acc3", "#dfe2ed", "#eef0f8"],
	yaxis: {
		show: false,
	},
	legend: {
		show: false,
	},
	tooltip: {
		y: {
			formatter: function (val) {
				return val;
			},
		},
	},
	plotOptions: {
		polarArea: {
			rings: {
				strokeWidth: 0,
			},
			spokes: {
				strokeWidth: 0,
			},
		},
	},
};

var chart = new ApexCharts(document.querySelector("#socialNetwork"), options);
chart.render();
