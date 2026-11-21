# AI Mode in Web Search

Open **Web Search → AI Mode**. **Ask AI** handles arithmetic and unit conversions locally. A ready browser or CPU model can generate answers and follow-ups. Without a ready model, the panel can build a study schedule, show an essay-writing guide, or display a credited Wikipedia excerpt for a relevant topic.

**Sources and on-device AI** controls Wikipedia lookup and model setup. Wikipedia lookup sends a short topic query to Wikimedia. Other local prompts stay on the device. The optional CPU model takes about 271 MB to download the first time. Its weights can be cached in the browser. Choose **Cancel model download** to stop setup.

**Connected AI** uses the authorized gateway and model configured for this browser tab. Select **Ask connected AI** to send the question to that provider. A follow-up includes the previous question and answer. **Use web research for sources** also sends the latest question of up to 200 characters to Brave Search and uses the gateway’s search quota. Setup, request limits, and provider costs are documented in [the gateway guide](../server/README.md).

Connected and supported local models can stream answers. **Stop answering** cancels the request and restores the last completed answer. Source numbers link to references supplied to the model. Related videos come from the arcade’s catalog. When a connected request fails, AI Mode can use a ready local model or a built-in guide. The fallback keeps the question on the device.
