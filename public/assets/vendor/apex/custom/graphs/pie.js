var options = {
	chart: {
		width: 300,
		type: "pie",
	},
	labels: ["Team A", "Team B", "Team C", "Team D", "Team E"],
	series: [20, 20, 20, 20, 20],
	legend: {
		position: "bottom",
	},
	dataLabels: {
		enabled: false,
	},
	stroke: {
		width: 0,
	},
	colors: ["#e65729", "#e9683e", "#eb7954", "#ee8969", "#ffbea9", "#ffdbcf"],
};
var chart = new ApexCharts(document.querySelector("#pie"), options);
chart.render();
