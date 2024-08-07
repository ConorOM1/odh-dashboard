/* eslint-disable camelcase */
import type { Interception } from 'cypress/types/net-stubbing';
import {
  buildMockPipelineV2,
  buildMockPipelines,
  mockDashboardConfig,
  mockDataSciencePipelineApplicationK8sResource,
  mockK8sResourceList,
  mockProjectK8sResource,
  mockRouteK8sResource,
} from '~/__mocks__';
import {
  DataSciencePipelineApplicationModel,
  RouteModel,
  ProjectModel,
} from '~/__tests__/cypress/cypress/utils/models';
import {
  executionPage,
  executionFilter,
} from '~/__tests__/cypress/cypress/pages/pipelines/executions';
import { mockGetExecutions, mockGetNextPageExecutions } from '~/__mocks__/mlmd/mockGetExecutions';
import { tablePagination } from '~/__tests__/cypress/cypress/pages/components/Pagination';
import { verifyRelativeURL } from '~/__tests__/cypress/cypress/utils/url';
import { initMlmdIntercepts } from './mlmdUtils';

const projectName = 'test-project-name';
const initialMockPipeline = buildMockPipelineV2({ display_name: 'Test pipeline' });

describe('ExecutionsError', () => {
  it('Fails to load executions list', () => {
    initIntercepts(false);
    executionPage.visit(projectName);
    executionPage.findText('There was an issue loading executions');
  });
});

describe('No Executions', () => {
  it('Has no executions', () => {
    initIntercepts(true, true);
    executionPage.visit(projectName);
    executionPage.findText('No executions');
  });
});

describe('Executions', () => {
  beforeEach(() => {
    initIntercepts(true);
    executionPage.visit(projectName);
  });

  it('Makes filter requests', () => {
    shouldFilterItems(FilterArgs.Execution, 'digit-classification');
    shouldFilterItems(FilterArgs.ID, '289');
    shouldFilterItems(FilterArgs.Status);
    shouldFilterItems(FilterArgs.Type);
  });

  it('Includes more entries and navigates pages', () => {
    setUpIntercept();
    tablePagination.top.selectToggleOption('20 per page');
    cy.wait('@request');
    setUpIntercept();
    tablePagination.top.selectToggleOption('30 per page');
    cy.wait('@request');
    setUpInterceptForNextPage();
    tablePagination.top.findNextButton().click();
    cy.wait('@request');
    setUpIntercept();
    tablePagination.top.findPreviousButton().click();
    cy.wait('@request');
  });

  it('Visits execution details page', () => {
    const id = 288;
    executionPage.findEntryByLink('digit-classification').click();
    executionPage.findText(`${id}`);
    executionPage.findText('system.ContainerExecution');
    executionPage.findText('Custom properties');
    verifyRelativeURL(`/executions/${projectName}/${id}`);
  });
});

export enum FilterArgs {
  Execution = 'Execution',
  ID = 'ID',
  Type = 'Type',
  Status = 'Status',
}

const setUpIntercept = () => {
  cy.interceptOdh(
    'POST /api/service/mlmd/:namespace/:serviceName/ml_metadata.MetadataStoreService/GetExecutions',
    { path: { namespace: projectName, serviceName: 'dspa' } },
    mockGetExecutions(),
  ).as('request');
};

const setUpInterceptForNextPage = () => {
  cy.interceptOdh(
    'POST /api/service/mlmd/:namespace/:serviceName/ml_metadata.MetadataStoreService/GetExecutions',
    { path: { namespace: projectName, serviceName: 'dspa' } },
    mockGetNextPageExecutions(),
  ).as('request');
};

const validateMlmdQuery = (interception: Interception, query: string) => {
  const interceptionDecoder = new TextDecoder('utf-8');
  expect(interceptionDecoder.decode(new Uint8Array(interception.request.body))).to.include(query);
};

const shouldFilterItems = (filter: FilterArgs, query?: string) => {
  switch (filter) {
    case FilterArgs.Execution:
      executionFilter.findSearchFilterItem(FilterArgs.Execution).click();
      if (typeof query === 'undefined') {
        throw new Error('Incorrect usage of shouldFilterItems');
      }
      setUpIntercept();
      executionFilter.findSearchFilter().type(query);
      cy.wait('@request').then((interception) => {
        validateMlmdQuery(
          interception,
          "custom_properties.display_name.string_value LIKE '%digit-classification%'",
        );
      });
      break;
    case FilterArgs.ID:
      executionFilter.findSearchFilterItem(FilterArgs.ID).click();
      if (typeof query === 'undefined') {
        throw new Error('Incorrect usage of shouldFilterItems');
      }
      setUpIntercept();
      executionFilter.findSearchFilter().type(query);
      cy.wait('@request').then((interception) => {
        validateMlmdQuery(interception, 'id = cast(289 as int64)');
      });
      break;
    case FilterArgs.Type:
      executionFilter.findSearchFilterItem(FilterArgs.Type).click();
      setUpIntercept();
      executionFilter.findTypeSearchFilterItem('system.ContainerExecution').click();
      cy.wait('@request').then((interception) => {
        validateMlmdQuery(interception, "type LIKE '%system.ContainerExecution%'");
      });
      break;
    case FilterArgs.Status:
      executionFilter.findSearchFilterItem(FilterArgs.Status).click();
      setUpIntercept();
      executionFilter.findTypeSearchFilterItem('Cached').click();
      cy.wait('@request').then((interception) => {
        validateMlmdQuery(interception, 'cast(last_known_state as int64) = 5');
      });
      break;
  }
};

const initIntercepts = (interceptMlmd: boolean, isExecutionsEmpty?: boolean) => {
  cy.interceptOdh('GET /api/config', mockDashboardConfig({ disablePipelineExperiments: false }));
  cy.interceptK8sList(
    DataSciencePipelineApplicationModel,
    mockK8sResourceList([
      mockDataSciencePipelineApplicationK8sResource({ namespace: projectName }),
    ]),
  );
  cy.interceptK8s(
    DataSciencePipelineApplicationModel,
    mockDataSciencePipelineApplicationK8sResource({ namespace: projectName }),
  );
  cy.interceptK8s(
    RouteModel,
    mockRouteK8sResource({
      notebookName: 'ds-pipeline-dspa',
      namespace: projectName,
    }),
  );
  cy.interceptK8sList(
    ProjectModel,
    mockK8sResourceList([
      mockProjectK8sResource({ k8sName: projectName, displayName: projectName }),
    ]),
  );
  cy.interceptOdh(
    'GET /api/service/pipelines/:namespace/:serviceName/apis/v2beta1/pipelines',
    {
      path: { namespace: projectName, serviceName: 'dspa' },
    },
    buildMockPipelines([initialMockPipeline]),
  );

  if (interceptMlmd) {
    initMlmdIntercepts(projectName, { isExecutionsEmpty });
  }
};
