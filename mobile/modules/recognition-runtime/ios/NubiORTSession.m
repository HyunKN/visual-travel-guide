#import "NubiORTSession.h"
#import <onnxruntime.h>
#import <math.h>
#import <string.h>

@implementation NubiORTSession {
  ORTEnv *_environment;
  ORTSession *_session;
}

static NSDictionary<NSString *, NSNumber *> *OutputWidths(void) {
  return @{@"buildingLogits": @3, @"partLogits": @3, @"focusLogits": @5};
}

static void ContractError(NSError **error, NSString *detail) {
  if (error) {
    *error = [NSError errorWithDomain:@"NubiRecognition" code:1
                             userInfo:@{NSLocalizedDescriptionKey: detail}];
  }
}

- (instancetype)initWithModelPath:(NSString *)modelPath error:(NSError **)error {
  self = [super init];
  if (!self) return nil;
  _environment = [[ORTEnv alloc] initWithLoggingLevel:ORTLoggingLevelWarning error:error];
  if (!_environment) return nil;
  ORTSessionOptions *options = [[ORTSessionOptions alloc] initWithError:error];
  if (!options || ![options setIntraOpNumThreads:2 error:error]) return nil;
  _session = [[ORTSession alloc] initWithEnv:_environment modelPath:modelPath
                             sessionOptions:options error:error];
  if (!_session) return nil;
  NSArray<NSString *> *inputs = [_session inputNamesWithError:error];
  if (!inputs) return nil;
  NSArray<NSString *> *outputs = [_session outputNamesWithError:error];
  if (!outputs) return nil;
  if (![inputs isEqualToArray:@[@"image"]] ||
      ![[NSSet setWithArray:outputs] isEqualToSet:[NSSet setWithArray:OutputWidths().allKeys]]) {
    ContractError(error, @"Unexpected model inputs or outputs");
    return nil;
  }
  return self;
}

- (NSDictionary<NSString *, NSArray<NSNumber *> *> *)runTensor:(NSData *)tensor
                                                         error:(NSError **)error {
  if (tensor.length != 3 * 256 * 256 * sizeof(float)) {
    ContractError(error, @"Unexpected input tensor length");
    return nil;
  }
  ORTValue *input = [[ORTValue alloc] initWithTensorData:[tensor mutableCopy]
                                          elementType:ORTTensorElementDataTypeFloat
                                                shape:@[@1, @3, @256, @256] error:error];
  if (!input) return nil;
  NSDictionary<NSString *, NSNumber *> *widths = OutputWidths();
  NSDictionary<NSString *, ORTValue *> *outputs =
    [_session runWithInputs:@{@"image": input} outputNames:[NSSet setWithArray:widths.allKeys]
                 runOptions:nil error:error];
  if (!outputs) return nil;
  NSMutableDictionary *result = [NSMutableDictionary dictionaryWithCapacity:widths.count];
  for (NSString *name in widths) {
    ORTValue *value = outputs[name];
    ORTTensorTypeAndShapeInfo *info = [value tensorTypeAndShapeInfoWithError:error];
    if (!info || info.elementType != ORTTensorElementDataTypeFloat ||
        ![info.shape isEqualToArray:@[@1, widths[name]]]) {
      ContractError(error, @"Unexpected output tensor shape or data type");
      return nil;
    }
    NSData *data = [value tensorDataWithError:error];
    NSUInteger width = widths[name].unsignedIntegerValue;
    if (data.length != width * sizeof(float)) {
      ContractError(error, @"Unexpected output buffer length");
      return nil;
    }
    NSMutableArray *logits = [NSMutableArray arrayWithCapacity:width];
    for (NSUInteger index = 0; index < width; index++) {
      float logit;
      memcpy(&logit, (const char *)data.bytes + index * sizeof(float), sizeof(float));
      if (!isfinite(logit)) {
        ContractError(error, @"Non-finite model output");
        return nil;
      }
      [logits addObject:@(logit)];
    }
    result[name] = logits;
  }
  return result;
}

+ (NSString *)runtimeVersion {
  return ORTVersion() ?: @"unknown";
}

@end
