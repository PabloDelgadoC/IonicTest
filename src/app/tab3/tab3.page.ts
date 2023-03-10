import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { AlertController, isPlatform, ToastController } from '@ionic/angular';
import write_blob from 'capacitor-blob-writer';
import { PreviewAnyFile } from '@ionic-native/preview-any-file/ngx';

const APP_DIRECTORY = Directory.Documents;

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss']
})

export class Tab3Page implements OnInit {

	folderContent:any = [];
	currentFolder = '';
	copyFile:any;

	@ViewChild('filepicker')
	uploader!: ElementRef;

  constructor(
    private route: ActivatedRoute,
		private alertCtrl: AlertController,
		private router: Router,
		private previewAnyFile: PreviewAnyFile,
		private toastCtrl: ToastController
  ) {}

  ngOnInit() {
		this.currentFolder = this.route.snapshot.paramMap.get('folder') || '';
		this.loadDocuments();
	}

  async loadDocuments() {
	const folderContent = await Filesystem.readdir({
		directory: APP_DIRECTORY,
		path: this.currentFolder
	});

    this.folderContent = folderContent.files.map((file) => {
		return {
			name: file.name,
			isFile: file.type === "file" ? true : false //includes('.')
		};
	});
	}

  async createFolder() {
	let alert = await this.alertCtrl.create({
		header: 'Create folder',
		message: 'Please specify the name of the new folder',
		inputs: [
			{
				name: 'name',
				type: 'text',
				placeholder: 'MyDir'
			}
		],
		buttons: [
			{
				text: 'Cancel',
				role: 'cancel'
			},
			{
				text: 'Create',
				handler: async (data) => {
					await Filesystem.mkdir({
						directory: APP_DIRECTORY,
						path: `${this.currentFolder}/${data.name}`
					});
					this.loadDocuments();
				}
			}
		]
	});

	await alert.present();
	}

	addFile() {
		this.uploader.nativeElement.click();
	}
	
	async fileSelected($event:any) {
		const selected = $event.target.files[0];

		await write_blob({
			directory: APP_DIRECTORY,
			path: `${this.currentFolder}/${selected.name}`,
			blob: selected,
			on_fallback(error) {
				console.error('error: ', error);
			}
		});

		this.loadDocuments();
	}

	async itemClicked(entry:any) {
		if (this.copyFile) {
		  // We can only copy to a folder
		  if (entry.isFile) {
			let toast = await this.toastCtrl.create({
			  message: 'Please select a folder for your operation'
			});
			await toast.present();
			return;
		  }
		  // Finish the ongoing operation
		  this.finishCopyFile(entry);
		} else {
		  // Open the file or folder
		  if (entry.isFile) {
			this.openFile(entry);
		  } else {
			let pathToOpen =
			  this.currentFolder != '' ? this.currentFolder + '/' + entry.name : entry.name;
			let folder = encodeURIComponent(pathToOpen);
			this.router.navigateByUrl(`/home/${folder}`);
		  }
		}
	}

	async openFile(entry:any) {
		if (isPlatform('hybrid')) {
		  // Get the URI and use our Cordova plugin for preview
		  const file_uri = await Filesystem.getUri({
			directory: APP_DIRECTORY,
			path: this.currentFolder + '/' + entry.name
		  });
	
		  this.previewAnyFile.preview(file_uri.uri)
			.then((res: any) => console.log(res))
			.catch((error: any) => console.error(error));
		} else {
		  // Browser fallback to download the file
		  const file = await Filesystem.readFile({
			directory: APP_DIRECTORY,
			path: this.currentFolder + '/' + entry.name
		  });
		  	
		  const blob = this.b64toBlob(file.data, '');
		  const blobUrl = URL.createObjectURL(blob);
	
		  let a = document.createElement('a');
		  document.body.appendChild(a);
		  a.setAttribute('style', 'display: none');
		  a.href = blobUrl;
		  a.download = entry.name;
		  a.click();
		  window.URL.revokeObjectURL(blobUrl);
		  a.remove();
		}
	}

	// Helper for browser download fallback
	// https://betterprogramming.pub/convert-a-base64-url-to-image-file-in-angular-4-5796a19fdc21
	b64toBlob = (b64Data:any, contentType = '', sliceSize = 512) => {
		const byteCharacters = atob(b64Data);
		const byteArrays = [];

		for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
			const slice = byteCharacters.slice(offset, offset + sliceSize);

			const byteNumbers = new Array(slice.length);
			for (let i = 0; i < slice.length; i++) {
				byteNumbers[i] = slice.charCodeAt(i);
			}

			const byteArray = new Uint8Array(byteNumbers);
			byteArrays.push(byteArray);
		}

		const blob = new Blob(byteArrays, { type: contentType });
		return blob;
	};

	async delete(entry:any) {
		if (entry.isFile) {
		  await Filesystem.deleteFile({
			directory: APP_DIRECTORY,
			path: this.currentFolder + '/' + entry.name
		  });
		} else {
		  await Filesystem.rmdir({
			directory: APP_DIRECTORY,
			path: this.currentFolder + '/' + entry.name,
			recursive: true // Removes all files as well!
		  });
		}
		this.loadDocuments();
	}

	startCopy(file:any) {
		this.copyFile = file;
	  }
	
	  async finishCopyFile(entry:any) {
		// Make sure we don't have any additional slash in our path
		const current = this.currentFolder != '' ? `/${this.currentFolder}` : ''
	
		const from_uri = await Filesystem.getUri({
		  directory: APP_DIRECTORY,
		  path: `${current}/${this.copyFile.name}`
		});
	
		const dest_uri = await Filesystem.getUri({
		  directory: APP_DIRECTORY,
		  path: `${current}/${entry.name}/${this.copyFile.name}`
		});
	
		await Filesystem.copy({
		  from: from_uri.uri,
		  to: dest_uri.uri
		});
		this.copyFile = null;
		this.loadDocuments();
	  }

}
