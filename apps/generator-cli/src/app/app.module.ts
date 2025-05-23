import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { HttpModule, HttpModuleOptions } from '@nestjs/axios';
import { Command } from 'commander';
import { ProxyAgent } from 'proxy-agent';

import { COMMANDER_PROGRAM, LOGGER } from './constants';
import { VersionManagerController } from './controllers/version-manager.controller';
import {
  ConfigService,
  GeneratorService,
  PassThroughService,
  UIService,
  VersionManagerService,
} from './services';

const hasHttpProxyEnvs = process.env.HTTP_PROXY || process.env.http_proxy;
const hasHttpsProxyEnvs = process.env.HTTPS_PROXY || process.env.https_proxy;
const httpModuleConfig: HttpModuleOptions = {};

const proxyAgent = new ProxyAgent();

if (hasHttpProxyEnvs) {
  httpModuleConfig.proxy = false;
  httpModuleConfig.httpAgent = proxyAgent;
}

if (hasHttpsProxyEnvs) {
  httpModuleConfig.proxy = false;
  httpModuleConfig.httpsAgent = proxyAgent;
}

@Module({
  imports: [
    HttpModule.register({
      ...httpModuleConfig,
    }),
  ],
  controllers: [VersionManagerController],
  providers: [
    UIService,
    ConfigService,
    GeneratorService,
    PassThroughService,
    VersionManagerService,
    {
      provide: COMMANDER_PROGRAM,
      useValue: new Command('openapi-generator-cli')
        .helpOption(false)
        .usage('<command> [<args>]')
        .option(
          '--openapitools <openapitools.json>',
          'Use the specified openapi-generator-cli configuration file',
        ),
    },
    { provide: LOGGER, useValue: console },
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    @Inject(COMMANDER_PROGRAM) private readonly program: Command,
    private readonly versionManager: VersionManagerService,
    private readonly passThroughService: PassThroughService,
  ) {}

  onApplicationBootstrap = async () => {
    let selectedVersion = this.versionManager.getSelectedVersion();

    if (!selectedVersion) {
      const [{ version }] = await this.versionManager
        .search(['latest'])
        .toPromise();
      await this.versionManager.setSelectedVersion(version);
      selectedVersion = version;
    }

    await this.versionManager.downloadIfNeeded(selectedVersion);
    await this.passThroughService.init();
    this.program.parse(process.argv);
  };
}
