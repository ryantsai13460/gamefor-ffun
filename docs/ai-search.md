# AI Mode in Web Search

Open **Web Search → AI Mode**. **Ask AI** handles arithmetic, unit conversions, averages, medians, percent change, and fraction simplification locally. Try “What percent is 30 out of 80?” or “Find the median of 3, 7, and 11.” A ready browser or CPU model can generate answers and follow-ups. Built-in guides cover study schedules and essay planning.

For supported topics such as why the sky is blue, how the water cycle works, or the difference between HTML and CSS, AI Mode can show an offline explanation with links to its references. For other eligible topics, Wikipedia lookup can return a credited excerpt. Comparisons can show one source excerpt for each subject. [NASA Space Place](https://spaceplace.nasa.gov/blue-sky/en/) · [U.S. Geological Survey](https://www.usgs.gov/water-science-school/water-cycle) · [MDN HTML guide](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Structuring_content/Basic_HTML_syntax) · [MDN CSS guide](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Styling_basics/What_is_CSS)

Choose **Draft in AI Mode** in Web Search to bring the query into AI Mode in the current tab. Edit the question, then choose **Ask AI** to submit it. If an edited question is open or an answer is underway, choose **Use Web Search query** when it becomes available.

**Sources and on-device AI** controls Wikipedia lookup and model setup. Wikipedia lookup sends a short topic query to Wikimedia. Other local prompts stay on the device. The optional CPU model takes about 271 MB to download the first time. Its weights can be cached in the browser. Choose **Cancel model download** to stop setup.

**Connected AI** uses the authorized gateway and model configured for this browser tab. Select **Ask connected AI** to send the question to that provider. A follow-up includes the previous question and answer. **Use web research for sources** also sends the latest question of up to 200 characters to Brave Search and uses the gateway’s search quota. Setup, request limits, and provider costs are documented in [the gateway guide](../server/README.md).

Connected and supported local models can stream answers. **Stop answering** cancels the request and restores the last completed answer. Source numbers link to references supplied to the model. Related videos come from the arcade’s catalog. When a connected request fails, AI Mode can use a ready local model or a built-in guide. The fallback keeps the question on the device.
