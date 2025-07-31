import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError
} from "n8n-workflow";
import {convertToHtml, extractRawText} from "mammoth";
import turndown from "turndown";


export class DocxConverter implements INodeType {
	description: INodeTypeDescription = {
		displayName: "Docx Converter",
		name: "docxConverter",
		icon: "file:icon.svg",
		group: ["transform"],
		version: 1,
		description: "Convert DOCX files to other formats",
		defaults: {
			name: "Docx Converter"
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: "Input Binary Field",
				name: "inputField",
				type: "string",
				default: "data",
				required: true,
				description: "The name of the input field containing the file data to be processed",
			},
			{
				displayName: "Output Format",
				name: "outputFormat",
				type: "options",
				options: [
					{name: "HTML", value: "html"},
					{name: "TXT", value: "txt"},
					{name: "Markdown", value: "markdown"},
					{name: "All", value: "all"},
				],
				default: "all",
				description: "The format to convert the DOCX file into",
			},
			// Additional properties can be added here
		],
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const output: INodeExecutionData[] = [];
		const turndownService = new turndown();
		const inputField = this.getNodeParameter("inputField", 0) as string;
		const outputFormat = this.getNodeParameter("outputFormat", 0) as string;

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			const item = items[itemIndex];
			const binaryData = item.binary?.[inputField];

			if (!binaryData) {
				throw new NodeOperationError(this.getNode(), `No binary data found in field "${inputField}" for item ${itemIndex + 1}`);
			}

			if (binaryData.mimeType !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
				throw new NodeOperationError(this.getNode(), `Unsupported MIME type: ${binaryData.mimeType}. Expected DOCX file.`);
			}

			try {
				// Convert the base64 string to a Buffer
				const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, inputField);

				let html: string | undefined;
				let textContent: string | undefined;
				let markdown: string | undefined;

				switch (outputFormat) {
					case "html":
						html = (await convertToHtml({buffer})).value;
						break;
					case "txt":
						textContent = (await extractRawText({buffer})).value;
						break;
					case "markdown":
						// For markdown, we can use HTML as a base and convert it to markdown
						html = (await convertToHtml({buffer})).value;
						markdown = turndownService.turndown(html);
						break;
					case "all":
						// For markdown, we can use HTML as a base and convert it to markdown
						html = (await convertToHtml({buffer})).value;
						textContent = (await extractRawText({buffer})).value;
						markdown = turndownService.turndown(html);
						break;
					default:
						break;
				}

				output.push({
					json: {
						html: html,
						textContent: textContent,
						markdown: markdown,
					},
					pairedItem: {item: itemIndex}
				});
			} catch (error) {
				if (this.continueOnFail()) {
					output.push({json: {error: error.message}, pairedItem: {item: itemIndex}});
				} else {
					throw error;
				}
			}
		}


		return this.prepareOutputData(output);
	}

}
