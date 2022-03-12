const URL_ROOT = "https://www.thebluealliance.com/api/v3/";
const AUTH_HEADER = "?X-TBA-Auth-Key=";
const TABLE_SORTS = [
    parseTeamNum,
    parsePercent,
    parseFloat,
    parseFloat,
    parsePercent,
    parsePercent,
    parsePercent,
    parsePercent,
    parseFloat,
    parseFloat
];
const MATCH_SORTS = [
    parseMatchNum,
    parseTeamNum,
    parseTeamNum,
    parseTeamNum,
    parseFloat,
    parseFloat,
    parseTeamNum,
    parseTeamNum,
    parseTeamNum,
    parseFloat,
    parseFloat,
    parsePercent,
    (a) => a,
    (a) => a
];
const MATCH_DIRECTIONS = [
    increasing,
    increasing,
    increasing,
    increasing,
    decreasing,
    decreasing,
    increasing,
    increasing,
    increasing,
    decreasing,
    decreasing,
    decreasing,
    increasing,
    increasing
];


var savedStatistics = {};
var teamAmount = 0;
var authKey = "";
var eventKey = "";
var currentTableSortCol = -1;
var currentTableSortDirection = increasing;
var currentMatchSortCol = -1;
var currentMatchSortDirection = increasing;


function sum(arr) {
    return arr.reduce((a, b) => a + b);
}


function avg(arr) {
    if (arr.length > 0) {
        return sum(arr)/arr.length;
    } else {
        return 0;
    }
}


function stdev(arr) {
    if (arr.length > 0) {
        let average = avg(arr);
        let sum = 0;
        for (let a of arr) {
            sum += Math.pow(average - a, 2);
        }
        return Math.sqrt(sum/arr.length);
    } else {
        return 0;
    }
}


function url(path) {
    return URL_ROOT + path + AUTH_HEADER + authKey;
}


function getEventKey() {
    let value = document.getElementById("eventKey").value;
    if (value == "") throw "Event key must not be empty.";
    return value;
}


function getAuthKey() {
    let value = document.getElementById("authKey").value;
    if (value == "") throw "Authentication key must not be empty.";
    return value;
}


function getMatchTable() {
    return document.getElementById("matchTable");
}


function getTeamTable() {
    return document.getElementById("teamTable");
}


function getMatchInfo(match, teamKey) {
    let blueKeys = match["alliances"]["blue"]["team_keys"];
    let redKeys = match["alliances"]["red"]["team_keys"];
    let blueIndex = blueKeys.indexOf(teamKey) + 1;
    let redIndex = redKeys.indexOf(teamKey) + 1;

    if (blueIndex > 0) {
        return [match["score_breakdown"]["blue"], blueIndex];
    } else if (redIndex > 0) {
        return [match["score_breakdown"]["red"], redIndex];
    } else {
        throw "Team must be in an alliance.";
    }
}


function getBreakdowns(matches, teamKey) {
    let breakdowns = [];
    matches.forEach((match) => {
        if (match["score_breakdown"] != undefined) {
            let [scores, position] = getMatchInfo(match, teamKey);
            let taxi = scores["taxiRobot" + position];
            let endgame = scores["endgameRobot" + position];
            let breakdown = {};

            breakdown["taxi"] = taxi == "Yes" ? 1 : 0;
            breakdown["autoCargo"] = scores["autoCargoPoints"]/3;
            breakdown["teleopCargo"] = scores["teleopCargoPoints"]/3;
            breakdown["low"] = endgame == "Low" ? 1 : 0;
            breakdown["mid"] = endgame == "Mid" ? 1 : 0;
            breakdown["high"] = endgame == "High" ? 1 : 0;
            breakdown["traversal"] = endgame == "Traversal" ? 1 : 0;

            breakdowns.push(breakdown);
        }
    });
    return breakdowns;
}


function getData(breakdowns) {
    let data = {
        "taxi": [], "autoCargo": [], "teleopCargo": [],
        "low": [], "mid": [], "high": [], "traversal": []
    };

    breakdowns.forEach((breakdown) => {
        Object.entries(breakdown).forEach(([key, value]) => {
            data[key].push(value);
        });
    });
    return data;
}


function getStatistics(data) {
    let statistics = {};
    Object.entries(data).forEach(([key, values]) => {
        statistics[key] = {};
        statistics[key]["avg"] = avg(values);
        statistics[key]["stdev"] = stdev(values);
    });
    return statistics;
}


function saveStatistics(teamKey, statistics) {
    savedStatistics[teamKey] = statistics;
    if (Object.keys(savedStatistics).length == teamAmount) {
        predictMatches();
    }
    return statistics;
}


function formatPercent(n) {
    return Math.round(n * 100) + "%";
}


function formatRound(n, d=2) {
    return Math.round(n * (10 ** d))/(10 ** d);
}


function getAvgScore(statistics) {
    let total = 0;
    total += statistics["taxi"]["avg"] * 2;
    total += statistics["autoCargo"]["avg"];
    total += statistics["teleopCargo"]["avg"];
    total += statistics["low"]["avg"] * 4;
    total += statistics["mid"]["avg"] * 6;
    total += statistics["high"]["avg"] * 10;
    total += statistics["traversal"]["avg"] * 15;
    return total;
}


function getVariance(statistics) {
    let total = 0;
    total += statistics["taxi"]["stdev"] ** 2;
    total += statistics["autoCargo"]["stdev"] ** 2;
    total += statistics["teleopCargo"]["stdev"] ** 2;
    total += statistics["low"]["stdev"] ** 2;
    total += statistics["mid"]["stdev"] ** 2;
    total += statistics["high"]["stdev"] ** 2;
    total += statistics["traversal"]["stdev"] ** 2;
    return total;
}


function getTeamCells(teamKey, statistics) {
    let cells = [];
    cells.push(teamKey);
    cells.push(formatPercent(statistics["taxi"]["avg"]));
    cells.push(formatRound(statistics["autoCargo"]["avg"]));
    cells.push(formatRound(statistics["teleopCargo"]["avg"]));
    cells.push(formatPercent(statistics["low"]["avg"]));
    cells.push(formatPercent(statistics["mid"]["avg"]));
    cells.push(formatPercent(statistics["high"]["avg"]));
    cells.push(formatPercent(statistics["traversal"]["avg"]));
    cells.push(formatRound(getAvgScore(statistics)));
    cells.push(formatRound(Math.sqrt(getVariance(statistics))));
    return cells;
}


function addTeam(teamKey) {
    fetch(url("team/" + teamKey + "/matches/2022"))
        .then((response) => response.json())
        .then((matches) => getBreakdowns(matches, teamKey))
        .then((breakdowns) => getData(breakdowns))
        .then((data) => getStatistics(data))
        .then((statistics) => saveStatistics(teamKey, statistics))
        .then((statistics) => getTeamCells(teamKey, statistics))
        .then((cells) => addTeamRow(cells))
        .catch((e) => console.log("error for team " + teamKey));
}


function setupTeams() {
    fetch(url("event/" + eventKey + "/teams/keys"))
        .then((response) => response.json())
        .then((teamKeys) => {
            teamAmount = teamKeys.length;
            teamKeys.forEach(addTeam);
        })
        .catch((e) => console.log("error fetching teams"));
}


function getAllianceStatistics(alliance) {
    let average = 0;
    let variance = 0;
    alliance.forEach((teamKey) => {
        let statistics = savedStatistics[teamKey];
        average += getAvgScore(statistics);
        variance += getVariance(statistics);
    });
    return [average, Math.sqrt(variance)]
}


function erf(x) {
    // save the sign of x
    var sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
  
    // constants
    var a1 =  0.254829592;
    var a2 = -0.284496736;
    var a3 =  1.421413741;
    var a4 = -1.453152027;
    var a5 =  1.061405429;
    var p  =  0.3275911;
  
    // A&S formula 7.1.26
    var t = 1.0/(1.0 + p*x);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y; // erf(-x) = -erf(x);
  }


function addMatch(match) {
    let blueKeys = match["alliances"]["blue"]["team_keys"];
    let redKeys = match["alliances"]["red"]["team_keys"];
    let [blueAvg, blueStd] = getAllianceStatistics(blueKeys);
    let [redAvg, redStd] = getAllianceStatistics(redKeys);
    let totalAvg = blueAvg - redAvg;
    let totalStd = Math.sqrt(blueStd ** 2 + redStd ** 2);
    let probablity = (1 + erf(totalAvg/(totalStd * Math.sqrt(2))))/2;

    let cells = [];
    cells.push(match["key"]);
    blueKeys.forEach((key) => cells.push(key));
    cells.push(formatRound(blueAvg));
    cells.push(formatRound(blueStd));
    redKeys.forEach((key) => cells.push(key));
    cells.push(formatRound(redAvg));
    cells.push(formatRound(redStd));
    cells.push(formatPercent(probablity));
    cells.push(probablity > 0.5 ? "blue" : "red");
    cells.push(match["winning_alliance"]);
    addMatchRow(cells);
}


function addMatches(matches) {
    matches.forEach((match) => addMatch(match));
}


function predictMatches() {
    fetch(url("event/" + eventKey + "/matches"))
        .then((response) => response.json())
        .then((matches) => addMatches(matches))
        .then((_) => sortMatches(0))
        .then((_) => sortTeams(0))
        .catch((e) => console.log("error fetching matches"));
}


function enter() {
    authKey = getAuthKey();
    eventKey = getEventKey();
    clearTables();
    setupTeams();
}


function clearTable(table, headers) {
    let length = table.rows.length;
    for (let i = headers; i < length; i += 1) {
        table.deleteRow(headers);
    }
}


function clearTables() {
    savedStatistics = {};
    teamAmount = 0;
    clearTable(getMatchTable(), 2);
    clearTable(getTeamTable(), 1);
}


function addRow(table, cells) {
    let row = table.insertRow(-1);
    for (let i = 0; i < cells.length; i += 1) {
        let cell = row.insertCell(i);
        cell.innerHTML = cells[i];
    }
}


function addMatchRow(cells) {
    addRow(getMatchTable(), cells);
}


function addTeamRow(cells) {
    addRow(getTeamTable(), cells);
}


function parseMatchNum(key) {
    if (key.match("qm\\d{2}$")) {
        return parseInt(key.substring(key.length - 2));
    } else if (key.match("qm\\d$")) {
        return parseInt(key.substring(key.length - 1));
    } else {
        return -1;
    }
}


function parseTeamNum(key) {
    if (key.match("frc\\d{1,4}")) {
        return parseInt(key.substring(3));
    } else {
        return -1;
    }
}


function parsePercent(key) {
    if (key.match("\\d{1,2}%")) {
        return parseInt(key.substring(0, key.length - 1));
    } else {
        return -1;
    }
}


function sortTable(table, headers, col, sort) {
    let switching = true;
    while (switching) {
        switching = false;
        let rows = table.rows;
        for (let i = headers; i < rows.length - 1; i++) {
            let x = rows[i].getElementsByTagName("TD")[col];
            let y = rows[i + 1].getElementsByTagName("TD")[col];
            if (sort(x.innerHTML, y.innerHTML)) {
                rows[i].parentNode.insertBefore(rows[i + 1], rows[i]);
                switching = true;
                break;
            }
        }
    }
}


function increasing(func) {
    return (a, b) => func(a) > func(b);
}


function decreasing(func) {
    return (a, b) => func(a) < func(b);
}


function sortMatches(col) {
    if (currentMatchSortCol == col) {
        if (currentMatchSortDirection == increasing) {
            currentMatchSortDirection = decreasing;
        } else {
            currentMatchSortDirection = increasing;
        }
    } else {
        currentMatchSortCol = col;
        currentMatchSortDirection = MATCH_DIRECTIONS[col];
    }

    let table = document.getElementById("matchTable");
    sortTable(table, 2, col, currentMatchSortDirection(MATCH_SORTS[col]));
}


function sortTeams(col) {
    if (currentTableSortCol == col) {
        if (currentTableSortDirection == increasing) {
            currentTableSortDirection = decreasing;
        } else {
            currentTableSortDirection = increasing;
        }
    } else {
        currentTableSortCol = col;
        currentTableSortDirection = col == 0 ? increasing : decreasing;
    }

    let table = document.getElementById("teamTable");
    sortTable(table, 1, col, currentTableSortDirection(TABLE_SORTS[col]));
}


function clickPress(event) {
    if (event.keyCode == 13) {
        enter();
    }
}
