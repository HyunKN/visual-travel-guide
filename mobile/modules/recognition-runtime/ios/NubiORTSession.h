#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface NubiORTSession : NSObject

- (nullable instancetype)initWithModelPath:(NSString *)modelPath error:(NSError **)error;
- (nullable NSDictionary<NSString *, NSArray<NSNumber *> *> *)runTensor:(NSData *)tensor
                                                                 error:(NSError **)error
    NS_SWIFT_NAME(run(_:));
+ (NSString *)runtimeVersion;

@end

NS_ASSUME_NONNULL_END
