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
    const PREFIX = 'mitele';
    const TITLE = 'mitele';
    const MITELE_BASEURL = 'http://www.mitele.es';
    const PYDOWNTV_BASEURL = 'http://www.pydowntv.com/api';
    const MITELE_LOGO = 'http://www.mitele.es/theme-assets/themes/views/themes/mitele/img/logo/mitele-head.png';
    const CATEGORIES = [
        {id: 'series-online',   title: 'Series'},
        {id: 'programas-tv',    title: 'Programas'},
        {id: 'tv-movies',       title: 'TV movies'},
        {id: 'deportes',        title: 'Deportes'},
        {id: 'viajes',          title: 'Viajes'}
    ];
    const REGEX_PROGRAM = /.*?href *= *"(.*?)" *>(.*?)<.*/;

    // Create the showtime service and link to the statPage
    plugin.createService(TITLE, PREFIX + ':start', 'video', true, MITELE_LOGO);

    // Map URIs and functions
    plugin.addURI(PREFIX + ':start', startPage);
    plugin.addURI(PREFIX + ':category:(.*)', categoryPage); //category object
    plugin.addURI(PREFIX + ':program:(.*)', programPage); // program object
    plugin.addURI(PREFIX + ':season:(.*)', seasonPage); // program object
    plugin.addURI(PREFIX + ':video:(.*)', videoPage); // video object

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
    function videoURI(video) {
        return PREFIX + ':video:' + showtime.JSONEncode(video);
    }

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
        page.metadata.logo = MITELE_LOGO;
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
        page.metadata.logo = MITELE_LOGO;
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
        var videos = parseVideos(html);

        (season.page <= 1) || displayPrevious(page, season, seasonURI);
        displayVideos(page, videos);
        displayNext(page, season, seasonURI);

        page.type = 'directory';
        page.contents = 'items';
        page.metadata.title = season.title;
        page.loading = false;
    }

    /**
     * Define a video page
     * Gets and plays the video
     *
     * @param page
     * @param video
     */
    function videoPage(page, video) {
        video = showtime.JSONDecode(video);
        var file = getVideoFile(video);
        var ext = file.split(':').pop();
        showtime.print('Playing: ' + file);
        var videoParams = {
            title: video.title,
            sources: [{url: file}]
        };
        page.type = (ext === 'mp3') ? 'music' : 'video';
        page.source = file;//'videoparams:' + showtime.JSONEncode(videoParams);
        page.loading = false;
    }

    // ==========================================================================
    // MODELS
    // ==========================================================================

    /**
     * Returns the HTML page from a category
     *
     * @param   {object} category
     * @returns {string} HTML page
     */
    function getCategoryHTML(category) {
        var url = MITELE_BASEURL ;//+ '/' + category.id;
        showtime.print(url);
        return showtime.httpReq(url).toString();
    }

    /**
     * Returns the HTML page from a program
     *
     * @param   {object} program
     * @returns {string} HTML page
     */
    function getProgramHTML(program) {
        var args = {};
        var url = MITELE_BASEURL + '/' + program.url;
        showtime.print(program.url);
        return showtime.httpReq(url, {args: args}).toString();
    }

    /**
     * Returns the HTML page from a season
     *
     * @param   {object} season
     * @returns {string} HTML page
     */
    function getSeasonHTML(season) {
        var args = {};
        var url = MITELE_BASEURL + '/temporadasbrowser/getCapitulos/' + season.id + '/' + season.page;
        showtime.print(url);
        return showtime.httpReq(url, {args: args}).toString();
    }

    function getVideoFile(video) {
        var args = {url: video.url};
        var json = showtime.httpReq(PYDOWNTV_BASEURL, {args: args}).toString();
        json = showtime.JSONDecode(json);
        if (!json.exito) {
            return null; // fail
        }
        return json.videos[0].url_video[0];
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
        showtime.print(html);
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
     * Parses the season html page and returns the list of videos
     *
     * @param   {object} html
     * @returns {Array} videos
     */
    function parseVideos(html) {
        var json = showtime.JSONDecode(html);
        var videos = [];
        for (var i = 0; i < json.episodes.length; i++ ) {
            var item = json.episodes[i];
            var video = {
                id: item.ID,
                title: item.post_title,
                subtitle: item.post_subtitle,
                description: item.post_content,
                date: item.post_date,
                icon: item.image,
                url: MITELE_BASEURL + item.url
            };
            videos.push(video);
        }
        return videos;
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
            page.appendItem(programURI(program), 'directory', metadata); // I think only video supports description
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
            page.appendItem(seasonURI(season), 'directory', metadata); // I think only video supports description
        }
    }

    /**
     * Display the video list
     *
     * @param page
     * @param {Array} videos
     */
    function displayVideos(page, videos) {
        for (var i = 0; i < videos.length; i++) {
            var video = videos[i];
            page.appendItem(videoURI(video), 'video', getVideoMetadata(video));
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
     * Returns a metadata object for a given video
     *
     * @param   {object} video
     * @returns {object} showtime item metadata
     */
    function getVideoMetadata(video) {
        var title = video.title;
        if (video.subtitle) {
            title += ' - ' + video.subtitle;
        }

        var desc = '<font size="4">' + 'Fecha: ' + '</font>';
        desc += '<font size="4" color="#daa520">' + video.date + '</font>\n';
        desc += video.description;

        return {
            title: new showtime.RichText(title),
            description: new showtime.RichText(desc),
            icon: video.icon
        };

    }

})(this);
