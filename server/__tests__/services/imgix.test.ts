import { Strapi } from '@strapi/strapi';
import imgixService from '../../services/imgix.service';
import { getStrapiMock } from '../utils/strapi';

describe('Service: IMGIX', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });
  describe('validateAPIKey', () => {
    const strapiInstance = getStrapiMock();

    it('should return valid true if the response is ok', async () => {
      // Arrange
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      // Act
      expect(await service.validateAPIKey('validApiKey')).toEqual({ valid: true });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://api.imgix.com/api/v1/sources', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer validApiKey',
        },
      });
    });
    it('should return valid false if the response is not ok', async () => {
      // Arrange
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      // Act
      const response = await service.validateAPIKey('invalidApiKey');
      // Assert
      expect(response).toEqual({ valid: false });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://api.imgix.com/api/v1/sources', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalidApiKey',
        },
      });
    });
  });
  describe('addAsset', () => {
    const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId' }, apiKey: 'mockApiKey' });
    const strapiInstance = getStrapiMock({
      imgixPlugin: {
        service() {
          return {
            getSettings: mockSettings,
          };
        },
      },
    });
    it('should add an asset', async () => {
      // Arrange
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      // Act
      await service.addAsset('some-super-path');
      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://api.imgix.com/api/v1/sources/sourceId/assets/add/some-super-path', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer mockApiKey',
        },
      });
    });
    it('should throw an error if the response is not ok', async () => {
      // Arrange
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      try {
        // Act
        await service.addAsset('some-not-super-path');
      } catch (e: any) {
        // Assert
        expect(e).toEqual(new Error('Failed to add asset'));
      } finally {
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('https://api.imgix.com/api/v1/sources/sourceId/assets/add/some-not-super-path', {
          method: 'POST',
          headers: {
            Authorization: 'Bearer mockApiKey',
          },
        });
      }
    });
  });
  describe('purgeAsset', () => {
    const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId@' }, apiKey: 'mockApiKey2' });
    const strapiInstance = getStrapiMock({
      imgixPlugin: {
        service() {
          return {
            getSettings: mockSettings,
          };
        },
      },
    });
    it('should purge an asset', async () => {
      // Arrange
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      global.fetch = jest.fn().mockResolvedValue({ ok: true });
      // Act
      await service.purgeAsset('some-super-path');
      // Assert
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('https://api.imgix.com/api/v1/purge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/vnd.api+json',
          Authorization: 'Bearer mockApiKey2',
        },
        body: JSON.stringify({
          data: {
            attributes: {
              url: 'some-super-path',
            },
            type: 'purges',
          },
        }),
      });
    });
    it('should throw an error if the response is not ok', async () => {
      // Arrange
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      global.fetch = jest.fn().mockResolvedValue({ ok: false });
      try {
        // Act
        await service.purgeAsset('some-not-super-path');
      } catch (e: any) {
        // Assert
        expect(e).toEqual(new Error('Failed to purge asset'));
      } finally {
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('https://api.imgix.com/api/v1/purge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Authorization: 'Bearer mockApiKey2',
          },
          body: JSON.stringify({
            data: {
              attributes: {
                url: 'some-not-super-path',
              },
              type: 'purges',
            },
          }),
        });
      }
    });
  });
  describe('getUploadDecorator', () => {
    it('should return an object with uploadStream, upload and delete methods', async () => {
      // Arrange
      const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId@' }, apiKey: 'mockApiKey2' });
      const strapiInstance = getStrapiMock({
        imgixPlugin: {
          service() {
            return {
              getSettings: mockSettings,
            };
          },
        },
      });
      const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
      // Act
      const uploadDecorator = service.getUploadDecorator();
      // Assert
      expect(uploadDecorator).toEqual({
        uploadStream: expect.any(Function),
        upload: expect.any(Function),
        delete: expect.any(Function),
      });
    });
    describe.each(['uploadStream', 'upload'])(`%s`, (method) => {
      const typedMethod = method as 'uploadStream' | 'upload';
      describe('when configuration is complete', () => {
        describe('when uploaded file is image', () => {
          it('should add asset to imgix', async () => {
            // Arrange
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId@', url: 'http://some.super.host.com/' }, apiKey: 'validApiKey' });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              uploadPlugin: {
                service(name: string) {
                  switch (name) {
                    case 'image-manipulation':
                      return {
                        isImage: jest.fn().mockResolvedValue(true),
                      };
                    default:
                      throw new Error('Unexpected service name');
                  }
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://localhost:1337'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.addAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const file = { url: 'some-super-path' };
            // Act
            await uploadDecorator[typedMethod](file as any);
            // Assert
            expect(service.addAsset).toHaveBeenCalledWith('some-super-path');
            expect(file.url).toEqual('http://some.super.host.com/some-super-path');
          });

        });
        describe('when uploaded file has absolut path', () => {
          it('should add asset to imgix and change path', async () => {
            // Arrange
            const mockSettings = jest.fn().mockResolvedValue({
              apiKey: 'validApiKey',
              mediaLibrarySourceUrl: 'http://aws.host.com',
              source: { id: 'sourceId@', url: 'http://imgix.host.com' },
            });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              uploadPlugin: {
                service(name: string) {
                  switch (name) {
                    case 'image-manipulation':
                      return {
                        isImage: jest.fn().mockResolvedValue(true),
                      };
                    default:
                      throw new Error('Unexpected service name');
                  }
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://some.super.host.com'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.addAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const file = { url: 'http://aws.host.com/some-super-path' };
            // Act
            await uploadDecorator[typedMethod](file as any);
            // Assert
            expect(service.addAsset).toHaveBeenCalledWith('http://aws.host.com/some-super-path');
            expect(file.url).toEqual('http://imgix.host.com/some-super-path');
          });

        });
        describe('when uploaded file is not image', () => {
          it('should add asset to imgix', async () => {
            // Arrange
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId@', url: 'http://some.super.host.com/' }, apiKey: 'validApiKey' });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              uploadPlugin: {
                service(name: string) {
                  switch (name) {
                    case 'image-manipulation':
                      return {
                        isImage: jest.fn().mockResolvedValue(false),
                      };
                    default:
                      throw new Error('Unexpected service name');
                  }
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://localhost:1337'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.addAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const file = { url: 'not-image-path' };
            // Act
            await uploadDecorator[typedMethod](file as any);
            // Assert
            expect(service.addAsset).not.toHaveBeenCalled();
            expect(file.url).toEqual('not-image-path');
          });
        });
      });
      describe('when API KEY is not provided or source id', () => {
        describe('when uploaded file is image', () => {
          it('should change file url', async () => {
            // Arrange
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId@', url: 'http://some.super.host.com/' }, apiKey: null });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              uploadPlugin: {
                service(name: string) {
                  switch (name) {
                    case 'image-manipulation':
                      return {
                        isImage: jest.fn().mockResolvedValue(true),
                      };
                    default:
                      throw new Error('Unexpected service name');
                  }
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://localhost:1337'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.addAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const file = { url: 'second-super-path' };
            // Act
            await uploadDecorator[typedMethod](file as any);
            // Assert
            expect(service.addAsset).not.toHaveBeenCalled();
            expect(file.url).toEqual('http://some.super.host.com/second-super-path');
          });

        });
        describe('when uploaded file is image', () => {
          it('should change file url', async () => {
            // Arrange
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: '', url: 'http://some.super.host.com/' }, apiKey: 'validAPIKEY' });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              uploadPlugin: {
                service(name: string) {
                  switch (name) {
                    case 'image-manipulation':
                      return {
                        isImage: jest.fn().mockResolvedValue(true),
                      };
                    default:
                      throw new Error('Unexpected service name');
                  }
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://localhost:1337'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.addAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const file = { url: 'second-super-path' };
            // Act
            await uploadDecorator[typedMethod](file as any);
            // Assert
            expect(service.addAsset).not.toHaveBeenCalled();
            expect(file.url).toEqual('http://some.super.host.com/second-super-path');
          });

        });
      });
      describe('when addAsset failed', () => {
        describe('when uploaded file is image', () => {
          it('should change file url with error log', async () => {
            // Arrange
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'sourceId@', url: 'http://some.super.host.com/' }, apiKey: 'invalidApiKey' });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              uploadPlugin: {
                service(name: string) {
                  switch (name) {
                    case 'image-manipulation':
                      return {
                        isImage: jest.fn().mockResolvedValue(true),
                      };
                    default:
                      throw new Error('Unexpected service name');
                  }
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://localhost:1337'),
              },
              log: {
                error: jest.fn(),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.addAsset = jest.fn().mockRejectedValue(new Error('Failed to add asset'));
            const uploadDecorator = service.getUploadDecorator();
            const file = { url: 'second-super-path' };
            // Act
            await uploadDecorator[typedMethod](file as any);
            // Assert
            expect(strapiInstance.log.error).toHaveBeenCalledWith('uploadStream: Failed to add asset');
            expect(service.addAsset).toHaveBeenCalledTimes(1);
            expect(file.url).toEqual('http://some.super.host.com/second-super-path');
          });
        });
      });
    });
    describe('delete', () => {
      describe('when configuration is complete', () => {
        describe('when asset path starts with source url', () => {
          it('should purge asset', async () => {
            // Arrange
            const sourceURL = 'http://imgix.host.com';
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'source', url: sourceURL }, apiKey: 'validApiKey' });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://some.super.host.com'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.purgeAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const assetPath = `/some-super-path`;
            const file = { url: `${sourceURL}${assetPath}` };
            // Act
            await uploadDecorator.delete(file as any);
            // Assert
            expect(service.purgeAsset).toHaveBeenCalledWith(`${sourceURL}${assetPath}`);
          });
        });
        describe('when asset path not starts with source url', () => {
          it('should not purging asset', async () => {
            // Arrange
            const sourceURL = 'http://imgix.host.com';
            const mockSettings = jest.fn().mockResolvedValue({ source: { id: 'source', url: sourceURL }, apiKey: 'validApiKey' });
            const strapiInstance = getStrapiMock({
              imgixPlugin: {
                service() {
                  return {
                    getSettings: mockSettings,
                  };
                },
              },
              config: {
                get: jest.fn().mockReturnValue('http://some.super.host.com'),
              },
            });
            const service = imgixService({ strapi: strapiInstance as unknown as Strapi });
            service.purgeAsset = jest.fn();
            const uploadDecorator = service.getUploadDecorator();
            const assetPath = `/some-super-path`;
            const file = { url: `http://some.other.host.com/${assetPath}` };
            // Act
            await uploadDecorator.delete(file as any);
            // Assert
            expect(service.purgeAsset).not.toHaveBeenCalled();
          });
        });

      });

    });
  });
});
