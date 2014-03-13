/*
 *  mitele  - Showtime Plugin
 *
 *  Copyright (C) 2014 Carlos Jurado
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
(function (plugin) {
    const PREFIX = plugin.getDescriptor().id;
    const TITLE = 'mitele';
    const LOGO = 'http://www.mitele.es/theme-assets/themes/views/themes/mitele/img/logo/mitele-head.png';
    const DESCRIPTION = 'olakase';
    const BASEURL = 'http://www.mitele.es';
    const PYDOWNTV_BASEURL = 'http://www.pydowntv.com/api';
    const CATEGORIES = [
        {id: 'series-online',   title: 'Series'},
        {id: 'programas-tv',    title: 'Programas'},
        {id: 'tv-movies',       title: 'TV movies'},
        {id: 'deportes',        title: 'Deportes'},
        {id: 'viajes',          title: 'Viajes'}
    ];
    const REGEX_PROGRAM = /.*?href *= *"(.*?)" *>(.*?)<.*/;
    const REGEX_RESULT = /<img *src *= *"(.*?)".*href *= *"(.*?)" *>(.*?)<.*?<p.*?>(.*?)<\/.*<p.*?>(.*?)</;

    // Create the showtime service and link to the statPage
    plugin.createService(TITLE, PREFIX + ':start', 'tv', true, LOGO);

    // Create the settings
    var settings = plugin.createSettings(TITLE, LOGO, DESCRIPTION);
    settings.createInfo('info', LOGO, DESCRIPTION);

    // Map URIs and functions
    plugin.addURI(PREFIX + ':start', startPage);
    plugin.addURI(PREFIX + ':category:(.*)', categoryPage); //category object
    plugin.addURI(PREFIX + ':program:(.*)', programPage); // program object
    plugin.addURI(PREFIX + ':season:(.*)', seasonPage); // program object
    plugin.addURI(PREFIX + ':episode:(.*)', episodePage); // episode object

    // URI functions
    function categoryURI(category) {
        return PREFIX + ':category:' + showtime.JSONEncode(category);
    }
    function programURI(program) {
        return PREFIX + ':program:' + showtime.JSONEncode(program);
    }
    function seasonURI(season) {
        return PREFIX + ':season:' + showtime.JSONEncode(season);
    }
    function episodeURI(episode) {
        return PREFIX + ':episode:' + showtime.JSONEncode(episode);
    }

    // Create the searcher
    plugin.addSearcher(TITLE, LOGO, searchPage);

    // ==========================================================================
    // CONTROLLERS
    // ==========================================================================

    /**
     * Define the start page
     * @param page
     */
    function startPage(page) {
        // Add categories
        for (var i = 0; i < CATEGORIES.length; i++) {
            var category = CATEGORIES[i];
            page.appendItem(categoryURI(category), 'directory', {title: category.title});
        }

        page.type = 'directory';
        page.contents = 'items';
        page.metadata.logo = LOGO;
        page.metadata.title = TITLE;
        page.loading = false;
    }

    /**
     * Define a program category page
     *
     * @param page
     * @param category
     */
    function categoryPage(page, category) {
        category = showtime.JSONDecode(category);
        var html = getCategoryHTML(category);
        var programs = parsePrograms(html, category);

        displayPrograms(page, programs);

        page.type = 'directory';
        page.contents = 'items';
        page.metadata.logo = LOGO;
        page.metadata.title = category.title;
        page.loading = false;
    }

    /**
     * Define a program page
     *
     * @param page
     * @param {string} program encoded program object
     */
    function programPage(page, program) {
        program = showtime.JSONDecode(program);
        var html = getProgramHTML(program);
        var seasons = parseSeasons(html);

        displaySeasons(page, seasons);

        page.type = 'directory';
        page.contents = 'items';
        page.metadata.logo = program.logo;
        page.metadata.title = program.title;
        page.loading = false;
    }

    /**
     * Define a season page
     *
     * @param page
     * @param {string} season encoded program object
     */
    function seasonPage(page, season) {
        season = showtime.JSONDecode(season);
        var html = getSeasonHTML(season);
        var episodes = parseEpisodes(html);

        (season.page <= 1) || displayPrevious(page, season, seasonURI);
        displayEpisodes(page, episodes);
        displayNext(page, season, seasonURI);

        page.type = 'directory';
        page.contents = 'items';
        page.metadata.title = season.title;
        page.loading = false;
    }

    /**
     * Define a search page
     *
     * @param page
     * @param {string} query
     */
    function searchPage(page, query) {
        showtime.trace('Searching: ' + query, PREFIX);
        var pag = 1;
        function paginator() {
            var html = getSearchHTML(query, pag++);
            var results = parseResults(html);
            displayEpisodes(page, results);
            page.entries = results.length;
            return results.length != 0;
        }

        paginator();
        page.type = 'directory';
        page.contents = 'ĺist';
        page.paginator = paginator;
        page.loading = false;
    }

    /**
     * Define a episode page
     * Gets and plays the episodes
     *
     * @param page
     * @param episode
     */
    function episodePage(page, episode) {
        episode = showtime.JSONDecode(episode);
        var video = getVideoParams(episode);

        showtime.trace('Playing: ' + video.sources[0].url, PREFIX);
        page.type = 'video';
        page.source = 'videoparams:' + showtime.JSONEncode(video);
        page.loading = false;
    }

    // ==========================================================================
    // MODELS
    // ==========================================================================

    /**
     * Returns the HTML page of a category
     *
     * @param   {object} category
     * @returns {string} HTML page
     */
    function getCategoryHTML(category) {
        var url = BASEURL ;
        showtime.trace('Loading: ' + url, PREFIX);
        return showtime.httpReq(url).toString();
    }

    /**
     * Returns the HTML page of a program
     *
     * @param   {object} program
     * @returns {string} HTML page
     */
    function getProgramHTML(program) {
        var url = BASEURL + '/' + program.url;
        showtime.trace('Loading: ' + program.url, PREFIX);
        return showtime.httpReq(url).toString();
    }

    /**
     * Returns the HTML page of a season
     *
     * @param   {object} season
     * @returns {string} HTML page
     */
    function getSeasonHTML(season) {
        var url = BASEURL + '/temporadasbrowser/getCapitulos/' + season.id + '/' + season.page;
        showtime.trace('Loading: ' + url, PREFIX);
        return showtime.httpReq(url).toString();
    }

    /**
     * Returns the HTML page of the query results
     *
     * @param query
     * @returns {*}
     */
    function getSearchHTML(query, pag) {
        var args = {buscar: query, pag: pag};
        var url = BASEURL + '/buscador/getResultsHtml/';
        showtime.trace('Loading: ' + url + '?buscar=' + query + '&pag=' + pag, PREFIX);
        return showtime.httpReq(url, {args: args}).toString();
    }

    /**
     * Returns a showtime videoparams object from a episode
     * Uses the PyDownTV API http://www.pydowntv.com/api to obtain the info
     *
     * @param episode
     * @returns {object}
     */
    function getVideoParams(episode) {
        var args = {url: episode.url};
        showtime.trace('Loading: ' + url + '?url=' + episode.url, PREFIX);
        var json = showtime.httpReq(PYDOWNTV_BASEURL, {args: args}).toString();
        json = showtime.JSONDecode(json);
        if (!json.exito) {
            return null; // fail
        }
        var sources = [];
        for (var i = 0; i < json.videos[0].url_video.length; i++) {
            sources.push({url: json.videos[0].url_video[i]});
        }
        return {
            sources: sources,
            title: json.titulos[0],
            no_fs_scan: true,
            canonicalUrl: episodeURI(episode)
        };
    }

    // ==========================================================================
    // HTML PARSERS
    // ==========================================================================

    /**
     * Parses the category html page and returns the list of programs
     *
     * @param   {string} html
     * @returns {Array} programs
     */
    function parsePrograms(html, category) {
        var init = html.indexOf('<div id="submenu_' + category.id);
        init = html.indexOf('<ul>', init);
        var end = html.indexOf('</div>', init);
        html = html.slice(init, end);
        html = html.replace(/[\n\r]/g, ' '); // Remove break lines

        // Split and parse programs
        var programs = [];
        var split = html.split(/<li>/);
        for (var i = 0; i < split.length; i++) {
            var item = split[i];
            var program = {};
            var match = item.match(REGEX_PROGRAM);
            if (match) {
                // Add the matched program to the list
                program.id = null;
                program.url = match[1];
                program.title = match[2];
                programs.push(program);
            }
        }
        return programs;
    }

    /**
     * Parses the program html page and returns the list of seasons
     *
     * @param   {string} html
     * @returns {Array} seasons
     */
    function parseSeasons(html) {
        var init = html.indexOf('.temporadasBrowser('); // Begins seasons call
        init = html.indexOf('[', init); // Begins season array
        var end = html.indexOf(']', init)+1; // Ends season array
        html = html.slice(init, end);
        html = html.replace(/[\n\r]/g, ' '); // Remove break lines

        var seasons = [];
        var items = showtime.JSONDecode(html);
        for(var i=0; i < items.length; i++) {
            var item = items[i];
            seasons.push({
                id: item.ID,
                title: item.post_title,
                order: item.orden,
                page: 1
            });
        }
        return seasons;
    }

    /**
     * Parses the season html page and returns the list of episodes
     *
     * @param   {string} html
     * @returns {Array} episodes
     */
    function parseEpisodes(html) {
        var json = showtime.JSONDecode(html);
        var episodes = [];
        for (var i = 0; i < json.episodes.length; i++ ) {
            var item = json.episodes[i];
            var episode = {
                id: item.ID,
                title: item.post_title,
                subtitle: item.post_subtitle,
                description: item.post_content,
                date: item.post_date,
                icon: item.image,
                url: BASEURL + item.url
            };
            episodes.push(episode);
        }
        return episodes;
    }

    /**
     * Parses the search html page an return the list of results
     * @param {string} html
     */
    function parseResults(html) {
        var init = html.indexOf('<div class="resultSet">');
        init = html.indexOf('<div class="post">', init);
        var end = html.indexOf('<div class="Pagination">', init);
        html = html.slice(init, end);
        html = html.replace(/[\n\r]/g, ' '); // Remove break lines

        var results = [];
        var split = html.split(/<div class="post">/);
        for (var i = 0; i < split.length; i++) {
            var item = split[i];
            var match = item.match(REGEX_RESULT)
            if (match) {
                var result = {
                    icon: match[1],
                    url: match[2],
                    title: match[3],
                    subtitle: match[4],
                    description: match[5]
                }
                results.push(result);
            }
        }
        return results;
    }

    // ==========================================================================
    // VIEWS
    // ==========================================================================

    function displayPrevious(page, item, callbackURI) {
        item.page--;
        page.appendItem(callbackURI(item), 'directory', {title: 'Página anterior'});
        item.page++;
    }

    function displayNext(page, item, callbackURI) {
        item.page++;
        page.appendItem(callbackURI(item), 'directory', {title: 'Página siguiente'});
        item.page--;
    }

    /**
     * Display the program list
     *
     * @param page
     * @param {Array} programs
     */
    function displayPrograms(page, programs) {
        for (var i = 0; i < programs.length; i++) {
            var program = programs[i];
            var metadata = getProgramMetadata(program);
            page.appendItem(programURI(program), 'directory', metadata);
        }
    }

    /**
     * Display the season list
     *
     * @param page
     * @param {Array} seasons
     */
    function displaySeasons(page, seasons) {
        for (var i = 0; i < seasons.length; i++) {
            var season = seasons[i];
            var metadata = getSeasonMetadata(season);
            page.appendItem(seasonURI(season), 'directory', metadata);
        }
    }

    /**
     * Display the episode list
     *
     * @param page
     * @param {Array} episodes
     */
    function displayEpisodes(page, episodes) {
        for (var i = 0; i < episodes.length; i++) {
            var episode = episodes[i];
            page.appendItem(episodeURI(episode), 'video', getEpisodeMetadata(episode));
        }
    }

    // ==========================================================================
    // VIEW HELPERS
    // ==========================================================================

    /**
     * Returns a metadata object for a given program
     *
     * @param   {object} program
     * @returns {object} showtime item metadata
     */
    function getProgramMetadata(program) {
        var title = program.title;
        return {
            title: new showtime.RichText(title),
            icon: program.logo
        };
    }
    /**
     * Returns a metadata object for a given season
     *
     * @param   {object} season
     * @returns {object} showtime item metadata
     */
    function getSeasonMetadata(season) {
        var title = season.title;
        return {
            title: new showtime.RichText(title)
        };
    }

    /**
     * Returns a metadata object for a given episode
     *
     * @param   {object} episode
     * @returns {object} showtime item metadata
     */
    function getEpisodeMetadata(episode) {
        var title = episode.title;
        var desc = '';
        if (episode.subtitle) {
            title += ' - ' + episode.subtitle;
        }

        if (episode.date) {
            desc += '<font size="4">' + 'Fecha: ' + '</font>';
            desc += '<font size="4" color="#daa520">' + episode.date + '</font>\n';
        }
        if (episode.description) {
            desc += episode.description;
        }

        return {
            title: new showtime.RichText(title),
            description: new showtime.RichText(desc),
            icon: episode.icon
        };

    }

})(this);
